import { BadRequestException } from '@nestjs/common';
import { PaymentProviderType, Prisma, VoucherStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService checkout', () => {
  function createTransaction(campaignOverrides: Record<string, unknown> = {}) {
    const campaign = {
      campaignId: '00000000-0000-4000-8000-000000000010',
      title: 'Voucher test',
      status: VoucherStatus.APPROVED,
      saleStartTime: new Date(Date.now() - 60_000),
      saleEndTime: new Date(Date.now() + 60_000),
      capacity: 100,
      soldQuantity: 5,
      reservedStock: 2,
      salePrice: new Prisma.Decimal('19.99'),
      refundAllowed: true,
      refundWindowHours: 48,
      refundPolicy: 'Hoàn tiền trong 48 giờ.',
      cancellationPolicy: 'Không hủy voucher đã sử dụng.',
      policyVersion: 3,
      ...campaignOverrides,
    };
    const item = { campaignId: campaign.campaignId, quantity: 2 };
    const tx = {
      $queryRaw: jest.fn(),
      cartItem: {
        findMany: jest.fn().mockResolvedValue([item]),
        deleteMany: jest.fn(),
      },
      voucherCampaign: {
        findUnique: jest.fn().mockResolvedValue(campaign),
        update: jest.fn(),
      },
      order: {
        create: jest.fn().mockResolvedValue({ orderId: 'order-1' }),
      },
      orderItem: { create: jest.fn() },
      inventoryReservation: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = {
      logActivity: jest.fn().mockResolvedValue(undefined),
    };
    return { campaign, prisma, tx, audit };
  }

  it('rejects a campaign that is not currently approved for sale', async () => {
    const { prisma, tx, audit } = createTransaction({ status: VoucherStatus.DRAFT });
    const service = new OrdersService(prisma as any, audit as any);

    await expect(
      service.checkout('00000000-0000-4000-8000-000000000001', {
        paymentProvider: PaymentProviderType.STRIPE,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('uses the locked current price and exact decimal arithmetic', async () => {
    const { campaign, prisma, tx, audit } = createTransaction();
    const service = new OrdersService(prisma as any, audit as any);

    await service.checkout('00000000-0000-4000-8000-000000000001', {
      paymentProvider: PaymentProviderType.STRIPE,
    });

    const orderData = tx.order.create.mock.calls[0][0].data;
    const itemData = tx.orderItem.create.mock.calls[0][0].data;
    expect(orderData.totalAmount.toString()).toBe('39.98');
    expect(itemData.unitPrice).toBe(campaign.salePrice);
    expect(itemData).toEqual(
      expect.objectContaining({
        refundAllowedSnapshot: true,
        refundWindowHoursSnapshot: 48,
        refundPolicySnapshot: 'Hoàn tiền trong 48 giờ.',
        cancellationPolicySnapshot: 'Không hủy voucher đã sử dụng.',
        policyVersionSnapshot: 3,
      }),
    );
    expect(tx.cartItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { campaignId: 'asc' } }),
    );
  });
});

describe('OrdersService refund integrity', () => {
  const customerId = '00000000-0000-4000-8000-000000000001';
  const orderId = '00000000-0000-4000-8000-000000000002';
  const campaignId = '00000000-0000-4000-8000-000000000003';

  function createRefundContext(usedVoucherCode: object | null) {
    const order = {
      orderId,
      customerId,
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      createdAt: new Date(),
      orderItems: [
        {
          campaignId,
          quantity: 1,
          refundAllowedSnapshot: true,
          refundWindowHoursSnapshot: 24,
        },
      ],
      paymentTransactions: [
        {
          paymentId: '00000000-0000-4000-8000-000000000004',
          requestAmountMinor: BigInt(1000),
          requestCurrency: 'VND',
        },
      ],
    };
    const tx = {
      $queryRaw: jest.fn(),
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest
          .fn()
          .mockResolvedValue({ ...order, orderStatus: 'CANCELLED' }),
      },
      voucherCode: {
        findFirst: jest.fn().mockResolvedValue(usedVoucherCode),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentRefund: { create: jest.fn().mockResolvedValue({}) },
      voucherCampaign: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    let transactionActive = false;
    const prisma = {
      $transaction: jest.fn(async (callback) => {
        transactionActive = true;
        try {
          return await callback(tx);
        } finally {
          transactionActive = false;
        }
      }),
    };
    const audit = {
      logActivity: jest.fn().mockImplementation(async () => {
        expect(transactionActive).toBe(true);
      }),
    };
    return { order, tx, prisma, audit };
  }

  it('rejects refund when a multi-use voucher has any usage history', async () => {
    const { tx, prisma, audit } = createRefundContext({ codeId: 'used-once' });
    const service = new OrdersService(prisma as any, audit as any);

    await expect(service.requestRefund(customerId, orderId)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.voucherCode.findFirst).toHaveBeenCalledWith({
      where: {
        orderItem: { orderId },
        OR: [{ status: 'USED' }, { usageLogs: { some: {} } }],
      },
      select: { codeId: true },
    });
    expect(tx.paymentRefund.create).not.toHaveBeenCalled();
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('cancels every unused status and writes audit inside the refund transaction', async () => {
    const { tx, prisma, audit } = createRefundContext(null);
    const service = new OrdersService(prisma as any, audit as any);

    await service.requestRefund(customerId, orderId);

    expect(tx.voucherCode.updateMany).toHaveBeenCalledWith({
      where: {
        orderItem: { orderId },
        status: { in: ['AVAILABLE', 'LOCKED', 'EXPIRED'] },
      },
      data: { status: 'CANCELLED' },
    });
    expect(tx.voucherCampaign.updateMany).toHaveBeenCalledWith({
      where: { campaignId, soldQuantity: { gte: 1 } },
      data: { soldQuantity: { decrement: 1 } },
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'REQUEST_REFUND',
        targetId: orderId,
      }),
      tx,
    );
  });
});

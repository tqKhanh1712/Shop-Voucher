import { BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  ReservationStatus,
} from '@prisma/client';
import { PaymentFinalizationService } from './payment-finalization.service';

describe('PaymentFinalizationService', () => {
  const paymentId = '00000000-0000-4000-8000-000000000060';
  const orderId = '00000000-0000-4000-8000-000000000061';
  const campaignId = '00000000-0000-4000-8000-000000000062';
  const reservationId = '00000000-0000-4000-8000-000000000063';
  const itemId = '00000000-0000-4000-8000-000000000064';
  const voucherExpiresAt = new Date('2030-12-31T16:59:59.000Z');

  function createContext(overrides?: {
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
    transactionStatus?: PaymentTransactionStatus;
    reservationStatus?: ReservationStatus;
    omitReservation?: boolean;
    expired?: boolean;
  }) {
    const orderStatus = overrides?.orderStatus ?? OrderStatus.PENDING;
    const paymentStatus = overrides?.paymentStatus ?? PaymentStatus.UNPAID;
    const transactionStatus =
      overrides?.transactionStatus ?? PaymentTransactionStatus.CREATED;
    const reservationStatus =
      overrides?.reservationStatus ?? ReservationStatus.ACTIVE;
    const order = {
      orderId,
      orderCode: 'ORD-PAYMENT-TEST',
      customerId: '00000000-0000-4000-8000-000000000001',
      orderStatus,
      paymentStatus,
      reservationExpiresAt: new Date(
        Date.now() + (overrides?.expired ? -60_000 : 60_000),
      ),
      orderItems: [
        {
          itemId,
          campaignId,
          quantity: 2,
          refundAllowedSnapshot: true,
          refundWindowHoursSnapshot: 48,
          campaign: { campaignId, usageEndTime: voucherExpiresAt },
        },
      ],
      inventoryReservations: overrides?.omitReservation
        ? []
        : [
            {
              reservationId,
              campaignId,
              quantity: 2,
              status: reservationStatus,
            },
          ],
    };
    const payment = {
      paymentId,
      orderId,
      status: transactionStatus,
      requestAmountMinor: 100_000n,
      requestCurrency: 'VND',
      expiresAt: new Date(Date.now() + (overrides?.expired ? -60_000 : 60_000)),
      order,
    };
    const tx = {
      $queryRaw: jest.fn(),
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
      },
      order: {
        update: jest.fn().mockResolvedValue({
          ...order,
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
        }),
      },
      inventoryReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucherCampaign: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderItem: { update: jest.fn() },
      voucherCode: { create: jest.fn() },
    };
    const prisma = {
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue({ orderId }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    return { prisma, tx };
  }

  const mockEmailService = {
    sendGiftEmail: jest.fn().mockResolvedValue(true),
  };

  it('rejects a late callback without issuing vouchers or increasing sold stock', async () => {
    const { prisma, tx } = createContext({
      orderStatus: OrderStatus.CANCELLED,
      transactionStatus: PaymentTransactionStatus.EXPIRED,
      expired: true,
    });
    const service = new PaymentFinalizationService(
      prisma as any,
      mockEmailService as any,
    );

    await expect(
      service.finalizePayment(paymentId, 'PROVIDER-LATE'),
    ).rejects.toThrow(BadRequestException);

    expect(tx.paymentTransaction.update).not.toHaveBeenCalled();
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.voucherCode.create).not.toHaveBeenCalled();
  });

  it('rejects inconsistent orders whose active reservation is missing', async () => {
    const { prisma, tx } = createContext({
      omitReservation: true,
    });
    const service = new PaymentFinalizationService(
      prisma as any,
      mockEmailService as any,
    );

    await expect(
      service.finalizePayment(paymentId, 'PROVIDER-MISSING-RESERVATION'),
    ).rejects.toThrow('Phiếu giữ chỗ của đơn hàng không còn hiệu lực.');

    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.voucherCode.create).not.toHaveBeenCalled();
  });

  it('commits active reservations and issues vouchers for a valid payment', async () => {
    const { prisma, tx } = createContext();
    const service = new PaymentFinalizationService(
      prisma as any,
      mockEmailService as any,
    );

    await service.finalizePayment(paymentId, 'PROVIDER-SUCCESS');

    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith({
      where: {
        reservationId,
        status: ReservationStatus.ACTIVE,
      },
      data: { status: ReservationStatus.COMMITTED },
    });
    expect(tx.voucherCampaign.updateMany).toHaveBeenCalledWith({
      where: {
        campaignId,
        reservedStock: { gte: 2 },
      },
      data: {
        reservedStock: { decrement: 2 },
        soldQuantity: { increment: 2 },
      },
    });
    expect(tx.voucherCode.create).toHaveBeenCalledTimes(2);
    const issuedCodes = tx.voucherCode.create.mock.calls.map(
      ([call]) => call.data.uniqueCode as string,
    );
    expect(issuedCodes).toHaveLength(2);
    expect(new Set(issuedCodes).size).toBe(2);
    for (const uniqueCode of issuedCodes) {
      expect(uniqueCode).toMatch(/^[0-9A-F]{12}$/);
    }
    expect(tx.orderItem.update).toHaveBeenCalledWith({
      where: { itemId },
      data: {
        refundDeadlineAt: expect.any(Date),
      },
    });
    expect(tx.voucherCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiresAt: voucherExpiresAt,
      }),
    });
  });

  it('does not issue voucher codes again after a successful callback replay', async () => {
    const { prisma, tx } = createContext({
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      transactionStatus: PaymentTransactionStatus.SUCCEEDED,
    });
    const service = new PaymentFinalizationService(
      prisma as any,
      mockEmailService as any,
    );

    await service.finalizePayment(paymentId, 'PROVIDER-SUCCESS');

    expect(tx.paymentTransaction.update).not.toHaveBeenCalled();
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.voucherCode.create).not.toHaveBeenCalled();
  });

  it('preserves the PayPal USD settlement contract from main', async () => {
    const { prisma, tx } = createContext();
    const service = new PaymentFinalizationService(
      prisma as any,
      mockEmailService as any,
    );

    await service.finalizePayment(paymentId, 'PAYPAL-CAPTURE-1', {
      settledAmountMinor: 400n,
      settledCurrency: 'USD',
      exchangeRate: 25_000,
    });

    expect(tx.paymentTransaction.update).toHaveBeenCalledWith({
      where: { paymentId },
      data: expect.objectContaining({
        providerTransactionId: 'PAYPAL-CAPTURE-1',
        settledAmountMinor: 400n,
        settledCurrency: 'USD',
        exchangeRate: 25_000,
      }),
    });
  });
});

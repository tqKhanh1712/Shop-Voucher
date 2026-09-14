import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentProviderType,
  PaymentStatus,
  PaymentTransactionStatus,
  UserRole,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService ownership', () => {
  const payment = {
    paymentId: 'payment-1',
    order: { customerId: 'owner-1' },
  };

  it('hides a payment from another customer', async () => {
    const prisma = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.getPaymentDetailsForActor(payment.paymentId, {
        userId: 'other-customer',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not create a payment attempt for another customer order', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.createPaymentAttempt(
        'other-customer',
        'order-1',
        PaymentProviderType.ZALOPAY,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create another payment attempt for an already paid order', async () => {
    const order = {
      orderId: 'order-1',
      customerId: 'owner-1',
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentTransactions: [],
    };
    const tx = {
      $queryRaw: jest.fn(),
      order: { findFirst: jest.fn().mockResolvedValue(order) },
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({ orderId: order.orderId }),
      },
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.createPaymentAttempt(
        'owner-1',
        order.orderId,
        PaymentProviderType.ZALOPAY,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows an admin to inspect payment status', async () => {
    const prisma = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.getPaymentDetailsForActor(payment.paymentId, {
        userId: 'admin-1',
        role: UserRole.ADMIN,
      }),
    ).resolves.toBe(payment);
  });

  it('rejects capture preflight after the order has expired', async () => {
    const orderId = '00000000-0000-4000-8000-000000000071';
    const prisma = {
      paymentTransaction: {
        findFirst: jest.fn().mockResolvedValue({
          paymentId: payment.paymentId,
          status: PaymentTransactionStatus.EXPIRED,
          expiresAt: new Date(Date.now() - 60_000),
          order: {
            orderId,
            orderStatus: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.UNPAID,
            reservationExpiresAt: new Date(Date.now() - 60_000),
          },
        }),
      },
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.assertPaymentPayable(payment.paymentId, 'owner-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('atomically binds a Stripe session and transitions CREATED to PENDING', async () => {
    const prisma = {
      paymentTransaction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          paymentId: payment.paymentId,
          status: PaymentTransactionStatus.PENDING,
        }),
      },
    };
    const service = new PaymentsService(prisma as any);

    await service.bindStripeSession(payment.paymentId, 'cs_test_1');

    expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith({
      where: {
        paymentId: payment.paymentId,
        provider: PaymentProviderType.STRIPE,
        providerOrderId: null,
        status: PaymentTransactionStatus.CREATED,
      },
      data: expect.objectContaining({
        providerOrderId: 'cs_test_1',
        status: PaymentTransactionStatus.PENDING,
      }),
    });
  });

  it('rejects a Stripe binding after the attempt was superseded', async () => {
    const prisma = {
      paymentTransaction: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          provider: PaymentProviderType.STRIPE,
          providerOrderId: null,
          status: PaymentTransactionStatus.CANCELLED,
        }),
      },
    };
    const service = new PaymentsService(prisma as any);

    await expect(
      service.bindStripeSession(payment.paymentId, 'cs_test_1'),
    ).rejects.toThrow(ConflictException);
  });
});

import { OrderStatus, PaymentStatus, ReservationStatus } from '@prisma/client';
import { ExpiryProcessor } from './expiry.processor';

describe('ExpiryProcessor', () => {
  const expired = {
    reservationId: '00000000-0000-4000-8000-000000000020',
    orderId: '00000000-0000-4000-8000-000000000021',
    campaignId: '00000000-0000-4000-8000-000000000022',
    quantity: 2,
    status: ReservationStatus.ACTIVE as ReservationStatus,
    expiresAt: new Date(Date.now() - 60_000),
  };

  function createPrisma(currentReservation = expired) {
    const tx = {
      $queryRaw: jest.fn(),
      inventoryReservation: {
        findUnique: jest.fn().mockResolvedValue(currentReservation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucherCampaign: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          orderId: expired.orderId,
          orderCode: 'ORD-TEST',
          orderStatus: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
        }),
        update: jest.fn(),
      },
    };
    const prisma = {
      inventoryReservation: {
        findMany: jest.fn().mockResolvedValue([expired]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    return { prisma, tx };
  }

  it('expires and releases an active reservation once', async () => {
    const { prisma, tx } = createPrisma();
    const processor = new ExpiryProcessor(prisma as any);

    await processor.handleExpiredReservations();

    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.voucherCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reservedStock: { decrement: expired.quantity } },
      }),
    );
    expect(tx.order.update).toHaveBeenCalledTimes(1);
  });

  it('does nothing when another worker already transitioned the reservation', async () => {
    const { prisma, tx } = createPrisma({
      ...expired,
      status: ReservationStatus.EXPIRED,
    });
    const processor = new ExpiryProcessor(prisma as any);

    await processor.handleExpiredReservations();

    expect(tx.inventoryReservation.updateMany).not.toHaveBeenCalled();
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});

import { BadRequestException, Logger } from '@nestjs/common';
import {
  OrderStatus,
  PaymentProviderType,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentWebhookProcessingStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { StripePaymentEvidence } from './adapters/stripe.adapter';
import { StripeWebhookService } from './stripe-webhook.service';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

describe('StripeWebhookService', () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const evidence = (overrides: Partial<StripePaymentEvidence> = {}) => ({
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    providerOrderId: 'cs_test_1',
    providerTransactionId: 'pi_test_1',
    providerEventId: 'evt_test_1',
    eventType: 'checkout.session.completed',
    amountMinor: 192_000n,
    currency: 'VND',
    status: 'SUCCEEDED' as const,
    checkoutStatus: 'complete',
    paidAt: new Date('2026-08-26T01:05:00.000Z'),
    payloadHash: 'a'.repeat(64),
    ...overrides,
  });

  const payment = (overrides: Record<string, unknown> = {}) => ({
    paymentId: PAYMENT_ID,
    orderId: ORDER_ID,
    provider: PaymentProviderType.STRIPE,
    providerOrderId: 'cs_test_1',
    providerTransactionId: null,
    requestAmountMinor: 192_000n,
    requestCurrency: 'VND',
    settledAmountMinor: null,
    settledCurrency: null,
    status: PaymentTransactionStatus.PENDING,
    createdAt: new Date('2026-08-26T01:00:00.000Z'),
    order: {
      orderId: ORDER_ID,
      orderStatus: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      inventoryReservations: [],
    },
    ...overrides,
  });

  function harness(options?: {
    webhookStatus?: PaymentWebhookProcessingStatus;
    payment?: ReturnType<typeof payment>;
    finalizationError?: Error;
  }) {
    const webhookEvent = {
      webhookEventId: '44444444-4444-4444-8444-444444444444',
      provider: PaymentProviderType.STRIPE,
      providerEventId: 'evt_test_1',
      eventType: 'checkout.session.completed',
      signatureValid: true,
      payloadHash: 'a'.repeat(64),
      processingStatus:
        options?.webhookStatus ?? PaymentWebhookProcessingStatus.RECEIVED,
      paymentId: null,
    };
    const currentPayment = options?.payment ?? payment();
    const tx = {
      $queryRaw: jest.fn(),
      paymentTransaction: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...currentPayment, refunds: [] }),
        update: jest.fn().mockResolvedValue(currentPayment),
      },
      order: { update: jest.fn().mockResolvedValue(currentPayment.order) },
      paymentRefund: {
        upsert: jest.fn().mockResolvedValue({
          idempotencyKey: `STRIPE-LATE-${PAYMENT_ID}`,
          status: PaymentRefundStatus.PENDING,
        }),
      },
      inventoryReservation: { updateMany: jest.fn() },
      voucherCampaign: { updateMany: jest.fn() },
    };
    const prisma = {
      paymentWebhookEvent: {
        upsert: jest.fn().mockResolvedValue(webhookEvent),
        update: jest.fn().mockResolvedValue(webhookEvent),
      },
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue(currentPayment),
        update: jest.fn().mockResolvedValue(currentPayment),
      },
      paymentRefund: {
        update: jest.fn().mockResolvedValue({}),
      },
      order: { update: jest.fn().mockResolvedValue(currentPayment.order) },
      $transaction: jest.fn(async (operation: any) =>
        typeof operation === 'function'
          ? operation(tx)
          : Promise.all(operation),
      ),
    };
    const stripeAdapter = {
      parseWebhookEvent: jest.fn(),
      refundPayment: jest.fn().mockResolvedValue({
        providerRefundId: 're_test_1',
        status: 'SUCCEEDED',
      }),
    };
    const finalization = {
      finalizePayment: options?.finalizationError
        ? jest.fn().mockRejectedValue(options.finalizationError)
        : jest.fn().mockResolvedValue({ orderId: ORDER_ID }),
    };
    return {
      prisma,
      tx,
      stripeAdapter,
      finalization,
      service: new StripeWebhookService(
        prisma as any,
        stripeAdapter as any,
        finalization as any,
      ),
    };
  }

  it('finalizes only evidence bound to the persisted Stripe attempt', async () => {
    const { service, finalization } = harness();

    await expect(service.processEvidence(evidence())).resolves.toEqual({
      received: true,
      outcome: 'CONFIRMED',
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
    });
    expect(finalization.finalizePayment).toHaveBeenCalledWith(
      PAYMENT_ID,
      'pi_test_1',
    );
  });

  it('rejects an amount mismatch before voucher issuance', async () => {
    const { service, finalization, prisma } = harness();

    await expect(
      service.processEvidence(evidence({ amountMinor: 1n })),
    ).rejects.toThrow(BadRequestException);
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
    expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processingStatus: PaymentWebhookProcessingStatus.FAILED,
          processingError: expect.stringContaining(
            'Stripe payment binding, amount, or currency does not match.',
          ),
        }),
      }),
    );
  });

  it('does not issue vouchers again for a processed event replay', async () => {
    const { service, finalization } = harness({
      webhookStatus: PaymentWebhookProcessingStatus.PROCESSED,
    });

    await expect(service.processEvidence(evidence())).resolves.toEqual({
      received: true,
      outcome: PaymentWebhookProcessingStatus.PROCESSED,
      paymentId: null,
    });
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });

  it('records and executes a sandbox refund when fulfillment is no longer possible', async () => {
    const expiredPayment = payment({
      status: PaymentTransactionStatus.EXPIRED,
      order: {
        orderId: ORDER_ID,
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.UNPAID,
        inventoryReservations: [],
      },
    });
    const { service, stripeAdapter, tx, prisma } = harness({
      payment: expiredPayment,
      finalizationError: new BadRequestException('expired'),
    });

    await expect(service.processEvidence(evidence())).resolves.toEqual({
      received: true,
      outcome: 'REFUNDED',
      paymentId: PAYMENT_ID,
    });
    expect(tx.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentTransactionStatus.REFUND_PENDING,
          settledAmountMinor: 192_000n,
        }),
      }),
    );
    expect(stripeAdapter.refundPayment).toHaveBeenCalledWith(
      'pi_test_1',
      `STRIPE-LATE-${PAYMENT_ID}`,
      PAYMENT_ID,
    );
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PaymentTransactionStatus.REFUNDED },
      }),
    );
  });

  it('moves a previously successful refund back to manual reconciliation when Stripe later reports failure', async () => {
    const refundedPayment = payment({
      status: PaymentTransactionStatus.REFUNDED,
      providerTransactionId: 'pi_test_1',
      order: {
        orderId: ORDER_ID,
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
        inventoryReservations: [],
      },
    });
    const { service, prisma } = harness({ payment: refundedPayment });
    const rawBody = Buffer.from('{"id":"evt_refund_failed"}');
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    prisma.paymentWebhookEvent.upsert.mockResolvedValue({
      webhookEventId: '55555555-5555-4555-8555-555555555555',
      payloadHash,
      processingStatus: PaymentWebhookProcessingStatus.RECEIVED,
      paymentId: null,
    } as any);
    (prisma.paymentRefund as any).findMany = jest.fn().mockResolvedValue([
      {
        refundId: '66666666-6666-4666-8666-666666666666',
        paymentId: PAYMENT_ID,
        providerRefundId: 're_test_1',
        amountMinor: 192_000n,
        currency: 'VND',
        payment: refundedPayment,
      },
    ]);

    await expect(
      service.processEvent(
        {
          id: 'evt_refund_failed',
          type: 'refund.failed',
          data: {
            object: {
              id: 're_test_1',
              status: 'failed',
              amount: 192000,
              currency: 'vnd',
              payment_intent: 'pi_test_1',
              metadata: { paymentId: PAYMENT_ID },
            },
          },
        } as any,
        rawBody,
      ),
    ).resolves.toEqual({
      received: true,
      outcome: 'REFUND_FAILED',
      paymentId: PAYMENT_ID,
    });
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith({
      where: { paymentId: PAYMENT_ID },
      data: { status: PaymentTransactionStatus.REFUND_PENDING },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
      data: { paymentStatus: PaymentStatus.REFUND_PENDING },
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      `Stripe refund re_test_1 failed for payment ${PAYMENT_ID}; manual reconciliation is required.`,
    );
  });
});

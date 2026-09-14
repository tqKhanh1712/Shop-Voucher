import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentProviderType,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentWebhookProcessingStatus,
  ReservationStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import {
  StripeAdapter,
  StripePaymentEvidence,
} from './adapters/stripe.adapter';
import { PaymentFinalizationService } from './payment-finalization.service';

const MAX_ERROR_LENGTH = 2_000;

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeAdapter: StripeAdapter,
    private readonly finalization: PaymentFinalizationService,
  ) {}

  async processEvent(event: Stripe.Event, rawBody: Buffer) {
    if (
      event.type === 'refund.created' ||
      event.type === 'refund.updated' ||
      event.type === 'refund.failed'
    ) {
      return this.processRefundEvent(event, event.data.object, rawBody);
    }

    const evidence = this.stripeAdapter.parseWebhookEvent(event, rawBody);
    if (!evidence) {
      return this.recordIgnoredEvent(
        event.id,
        event.type,
        createHash('sha256').update(rawBody).digest('hex'),
      );
    }
    return this.processEvidence(evidence);
  }

  private async processRefundEvent(
    event: Stripe.Event,
    stripeRefund: Stripe.Refund,
    rawBody: Buffer,
  ) {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const webhookEvent = await this.prisma.paymentWebhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: PaymentProviderType.STRIPE,
          providerEventId: event.id,
        },
      },
      update: {},
      create: {
        provider: PaymentProviderType.STRIPE,
        providerEventId: event.id,
        eventType: event.type,
        signatureValid: true,
        payloadHash,
        processingStatus: PaymentWebhookProcessingStatus.RECEIVED,
      },
    });
    if (webhookEvent.payloadHash !== payloadHash) {
      throw new BadRequestException(
        'Stripe event ID was replayed with a different payload.',
      );
    }
    if (
      webhookEvent.processingStatus ===
        PaymentWebhookProcessingStatus.PROCESSED ||
      webhookEvent.processingStatus === PaymentWebhookProcessingStatus.IGNORED
    ) {
      return {
        received: true,
        outcome: webhookEvent.processingStatus,
        paymentId: webhookEvent.paymentId,
      };
    }

    try {
      if (!stripeRefund.id) {
        throw new BadRequestException('Stripe refund event is missing its ID.');
      }
      const matches = await this.prisma.paymentRefund.findMany({
        where: {
          providerRefundId: stripeRefund.id,
          payment: { provider: PaymentProviderType.STRIPE },
        },
        include: { payment: { include: { order: true } } },
        take: 2,
      });
      if (matches.length !== 1) {
        throw new BadRequestException(
          'Stripe refund event does not match exactly one local refund.',
        );
      }

      const localRefund = matches[0];
      const payment = localRefund.payment;
      const paymentIntentId =
        typeof stripeRefund.payment_intent === 'string'
          ? stripeRefund.payment_intent
          : stripeRefund.payment_intent?.id;
      if (
        stripeRefund.metadata?.paymentId !== payment.paymentId ||
        payment.providerTransactionId !== paymentIntentId ||
        localRefund.amountMinor !== BigInt(stripeRefund.amount) ||
        localRefund.currency.trim().toUpperCase() !==
          stripeRefund.currency.trim().toUpperCase() ||
        (payment.status !== PaymentTransactionStatus.REFUND_PENDING &&
          payment.status !== PaymentTransactionStatus.REFUNDED)
      ) {
        throw new BadRequestException(
          'Stripe refund binding, amount, or currency does not match.',
        );
      }

      await this.prisma.paymentWebhookEvent.update({
        where: { webhookEventId: webhookEvent.webhookEventId },
        data: { paymentId: payment.paymentId },
      });

      const refundStatus = stripeRefund.status ?? 'pending';
      const succeeded = refundStatus === 'succeeded';
      const failed = refundStatus === 'failed' || refundStatus === 'canceled';
      await this.prisma.$transaction([
        this.prisma.paymentRefund.update({
          where: { refundId: localRefund.refundId },
          data: {
            status: succeeded
              ? PaymentRefundStatus.SUCCEEDED
              : failed
                ? PaymentRefundStatus.FAILED
                : PaymentRefundStatus.PENDING,
          },
        }),
        this.prisma.paymentTransaction.update({
          where: { paymentId: payment.paymentId },
          data: {
            status: succeeded
              ? PaymentTransactionStatus.REFUNDED
              : PaymentTransactionStatus.REFUND_PENDING,
          },
        }),
        this.prisma.order.update({
          where: { orderId: payment.orderId },
          data: {
            paymentStatus: succeeded
              ? PaymentStatus.REFUNDED
              : PaymentStatus.REFUND_PENDING,
          },
        }),
      ]);
      await this.markEvent(
        webhookEvent.webhookEventId,
        PaymentWebhookProcessingStatus.PROCESSED,
      );

      if (failed) {
        this.logger.error(
          `Stripe refund ${stripeRefund.id} failed for payment ${payment.paymentId}; manual reconciliation is required.`,
        );
      }
      return {
        received: true,
        outcome: succeeded
          ? 'REFUNDED'
          : failed
            ? 'REFUND_FAILED'
            : 'REFUND_PENDING',
        paymentId: payment.paymentId,
      };
    } catch (error: unknown) {
      await this.failEvent(webhookEvent.webhookEventId, error);
      throw error;
    }
  }

  /**
   * Processes either signed webhook evidence or an authenticated Stripe API
   * query produced by the reconciliation worker.
   */
  async processEvidence(evidence: StripePaymentEvidence) {
    const webhookEvent = await this.ensureWebhookEvent(evidence);
    if (
      webhookEvent.processingStatus ===
        PaymentWebhookProcessingStatus.PROCESSED ||
      webhookEvent.processingStatus === PaymentWebhookProcessingStatus.IGNORED
    ) {
      return {
        received: true,
        outcome: webhookEvent.processingStatus,
        paymentId: webhookEvent.paymentId,
      };
    }

    try {
      const payment = await this.prisma.paymentTransaction.findUnique({
        where: { paymentId: evidence.paymentId },
        include: { order: true },
      });
      this.assertEvidenceMatches(payment, evidence);

      if (
        webhookEvent.paymentId &&
        webhookEvent.paymentId !== evidence.paymentId
      ) {
        throw new ConflictException(
          'Stripe event ID is already bound to another payment.',
        );
      }

      await this.prisma.paymentWebhookEvent.update({
        where: { webhookEventId: webhookEvent.webhookEventId },
        data: { paymentId: evidence.paymentId },
      });

      if (evidence.status !== 'SUCCEEDED') {
        await this.markEvent(
          webhookEvent.webhookEventId,
          PaymentWebhookProcessingStatus.IGNORED,
        );
        return {
          received: true,
          outcome: 'IGNORED',
          paymentId: evidence.paymentId,
        };
      }

      if (payment.status === PaymentTransactionStatus.SUCCEEDED) {
        this.assertCompletedPaymentMatches(payment, evidence);
      }

      try {
        const order = await this.finalization.finalizePayment(
          evidence.paymentId,
          evidence.providerTransactionId,
        );
        await this.markEvent(
          webhookEvent.webhookEventId,
          PaymentWebhookProcessingStatus.PROCESSED,
        );
        return {
          received: true,
          outcome: 'CONFIRMED',
          paymentId: evidence.paymentId,
          orderId: order.orderId,
        };
      } catch (error: unknown) {
        if (!(error instanceof BadRequestException)) {
          throw error;
        }

        const outcome = await this.refundUnfulfillablePayment(evidence);
        await this.markEvent(
          webhookEvent.webhookEventId,
          PaymentWebhookProcessingStatus.PROCESSED,
        );
        return {
          received: true,
          outcome,
          paymentId: evidence.paymentId,
        };
      }
    } catch (error: unknown) {
      await this.failEvent(webhookEvent.webhookEventId, error);
      throw error;
    }
  }

  async retryPendingRefund(paymentId: string): Promise<void> {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      include: {
        refunds: {
          where: { status: PaymentRefundStatus.PENDING },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const refund = payment?.refunds[0];
    if (
      !payment ||
      payment.provider !== PaymentProviderType.STRIPE ||
      payment.status !== PaymentTransactionStatus.REFUND_PENDING ||
      !payment.providerTransactionId ||
      !refund
    ) {
      return;
    }

    await this.executeRefund(
      payment.paymentId,
      payment.orderId,
      payment.providerTransactionId,
      refund.idempotencyKey,
    );
  }

  private async ensureWebhookEvent(evidence: StripePaymentEvidence) {
    const webhookEvent = await this.prisma.paymentWebhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: PaymentProviderType.STRIPE,
          providerEventId: evidence.providerEventId,
        },
      },
      update: {},
      create: {
        provider: PaymentProviderType.STRIPE,
        providerEventId: evidence.providerEventId,
        eventType: evidence.eventType,
        signatureValid: true,
        payloadHash: evidence.payloadHash,
        processingStatus: PaymentWebhookProcessingStatus.RECEIVED,
      },
    });

    if (webhookEvent.payloadHash !== evidence.payloadHash) {
      throw new BadRequestException(
        'Stripe event ID was replayed with a different payload.',
      );
    }
    return webhookEvent;
  }

  private async recordIgnoredEvent(
    providerEventId: string,
    eventType: string,
    payloadHash: string,
  ) {
    const event = await this.prisma.paymentWebhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: PaymentProviderType.STRIPE,
          providerEventId,
        },
      },
      update: {},
      create: {
        provider: PaymentProviderType.STRIPE,
        providerEventId,
        eventType,
        signatureValid: true,
        payloadHash,
        processingStatus: PaymentWebhookProcessingStatus.IGNORED,
        processedAt: new Date(),
      },
    });
    if (event.payloadHash !== payloadHash) {
      throw new BadRequestException(
        'Stripe event ID was replayed with a different payload.',
      );
    }
    return { received: true, outcome: 'IGNORED' };
  }

  private assertEvidenceMatches(
    payment: {
      paymentId: string;
      orderId: string;
      provider: PaymentProviderType;
      providerOrderId: string | null;
      providerTransactionId: string | null;
      requestAmountMinor: bigint;
      requestCurrency: string;
      settledAmountMinor: bigint | null;
      settledCurrency: string | null;
      status: PaymentTransactionStatus;
      createdAt: Date;
    } | null,
    evidence: StripePaymentEvidence,
  ): asserts payment is NonNullable<typeof payment> {
    if (!payment) {
      throw new BadRequestException(
        'Stripe event does not match a local payment.',
      );
    }
    if (
      payment.provider !== PaymentProviderType.STRIPE ||
      payment.providerOrderId !== evidence.providerOrderId ||
      payment.orderId !== evidence.orderId ||
      payment.requestAmountMinor !== evidence.amountMinor ||
      payment.requestCurrency.trim().toUpperCase() !== evidence.currency
    ) {
      throw new BadRequestException(
        'Stripe payment binding, amount, or currency does not match.',
      );
    }
  }

  private assertCompletedPaymentMatches(
    payment: {
      providerTransactionId: string | null;
      settledAmountMinor: bigint | null;
      settledCurrency: string | null;
    },
    evidence: StripePaymentEvidence,
  ): void {
    if (
      payment.providerTransactionId !== evidence.providerTransactionId ||
      payment.settledAmountMinor !== evidence.amountMinor ||
      payment.settledCurrency?.trim().toUpperCase() !== evidence.currency
    ) {
      throw new ConflictException(
        'Stripe evidence conflicts with the completed payment.',
      );
    }
  }

  private async refundUnfulfillablePayment(
    evidence: StripePaymentEvidence,
  ): Promise<'REFUNDED' | 'REFUND_PENDING' | 'ALREADY_CONFIRMED'> {
    const prepared = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${evidence.orderId}::uuid
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT payment_id FROM "Payment_Transactions"
        WHERE payment_id = ${evidence.paymentId}::uuid
        FOR UPDATE
      `;

      const payment = await tx.paymentTransaction.findUnique({
        where: { paymentId: evidence.paymentId },
        include: {
          order: {
            include: {
              inventoryReservations: { orderBy: { campaignId: 'asc' } },
            },
          },
          refunds: {
            where: {
              idempotencyKey: `STRIPE-LATE-${evidence.paymentId}`,
            },
          },
        },
      });
      this.assertEvidenceMatches(payment, evidence);

      if (payment.status === PaymentTransactionStatus.SUCCEEDED) {
        this.assertCompletedPaymentMatches(payment, evidence);
        if (
          payment.order.orderStatus !== OrderStatus.CONFIRMED ||
          payment.order.paymentStatus !== PaymentStatus.PAID
        ) {
          throw new ConflictException(
            'Completed Stripe payment has an inconsistent local order state.',
          );
        }
        return { alreadyConfirmed: true as const };
      }

      const existingRefund = payment.refunds[0];
      if (
        payment.status === PaymentTransactionStatus.REFUNDED ||
        existingRefund?.status === PaymentRefundStatus.SUCCEEDED
      ) {
        return { alreadyRefunded: true as const };
      }

      for (const reservation of payment.order.inventoryReservations) {
        if (reservation.status !== ReservationStatus.ACTIVE) {
          continue;
        }
        await tx.$queryRaw`
          SELECT reservation_id FROM "Inventory_Reservations"
          WHERE reservation_id = ${reservation.reservationId}::uuid
          FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT campaign_id FROM "Voucher_Campaigns"
          WHERE campaign_id = ${reservation.campaignId}::uuid
          FOR UPDATE
        `;
        const expired = await tx.inventoryReservation.updateMany({
          where: {
            reservationId: reservation.reservationId,
            status: ReservationStatus.ACTIVE,
          },
          data: { status: ReservationStatus.EXPIRED },
        });
        if (expired.count === 1) {
          const released = await tx.voucherCampaign.updateMany({
            where: {
              campaignId: reservation.campaignId,
              reservedStock: { gte: reservation.quantity },
            },
            data: { reservedStock: { decrement: reservation.quantity } },
          });
          if (released.count !== 1) {
            throw new ConflictException(
              'Reserved stock is inconsistent while preparing a Stripe refund.',
            );
          }
        }
      }

      await tx.paymentTransaction.update({
        where: { paymentId: evidence.paymentId },
        data: {
          status: PaymentTransactionStatus.REFUND_PENDING,
          providerTransactionId: evidence.providerTransactionId,
          settledAmountMinor: evidence.amountMinor,
          settledCurrency: evidence.currency,
          paidAt:
            evidence.paidAt >= payment.createdAt
              ? evidence.paidAt
              : payment.createdAt,
          failureCode: 'LATE_OR_UNFULFILLABLE_STRIPE_PAYMENT',
          failureMessage:
            'Stripe confirmed payment after the order could no longer be fulfilled.',
        },
      });
      await tx.order.update({
        where: { orderId: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.REFUND_PENDING,
          ...(payment.order.orderStatus === OrderStatus.PENDING
            ? { orderStatus: OrderStatus.CANCELLED }
            : {}),
        },
      });
      const refund = await tx.paymentRefund.upsert({
        where: { idempotencyKey: `STRIPE-LATE-${evidence.paymentId}` },
        update: {},
        create: {
          paymentId: evidence.paymentId,
          amountMinor: evidence.amountMinor,
          currency: evidence.currency,
          status: PaymentRefundStatus.PENDING,
          idempotencyKey: `STRIPE-LATE-${evidence.paymentId}`,
          reason:
            'Verified Stripe payment arrived after the order became unfulfillable.',
        },
      });
      return {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        paymentIntentId: evidence.providerTransactionId,
        refundIdempotencyKey: refund.idempotencyKey,
      };
    });

    if ('alreadyConfirmed' in prepared) {
      return 'ALREADY_CONFIRMED';
    }
    if ('alreadyRefunded' in prepared) {
      return 'REFUNDED';
    }

    return this.executeRefund(
      prepared.paymentId,
      prepared.orderId,
      prepared.paymentIntentId,
      prepared.refundIdempotencyKey,
    );
  }

  private async executeRefund(
    paymentId: string,
    orderId: string,
    paymentIntentId: string,
    idempotencyKey: string,
  ): Promise<'REFUNDED' | 'REFUND_PENDING'> {
    const result = await this.stripeAdapter.refundPayment(
      paymentIntentId,
      idempotencyKey,
      paymentId,
    );

    if (result.status === 'FAILED') {
      await this.prisma.paymentRefund.update({
        where: { idempotencyKey },
        data: {
          providerRefundId: result.providerRefundId,
          status: PaymentRefundStatus.FAILED,
        },
      });
      throw new BadGatewayException(
        'Stripe accepted the payment but the automatic sandbox refund failed.',
      );
    }
    if (result.status === 'PENDING') {
      await this.prisma.paymentRefund.update({
        where: { idempotencyKey },
        data: {
          providerRefundId: result.providerRefundId,
          status: PaymentRefundStatus.PENDING,
        },
      });
      return 'REFUND_PENDING';
    }

    await this.prisma.$transaction([
      this.prisma.paymentRefund.update({
        where: { idempotencyKey },
        data: {
          providerRefundId: result.providerRefundId,
          status: PaymentRefundStatus.SUCCEEDED,
        },
      }),
      this.prisma.paymentTransaction.update({
        where: { paymentId },
        data: { status: PaymentTransactionStatus.REFUNDED },
      }),
      this.prisma.order.update({
        where: { orderId },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      }),
    ]);
    this.logger.warn(
      `Automatically refunded unfulfillable Stripe payment ${paymentId}.`,
    );
    return 'REFUNDED';
  }

  private async markEvent(
    webhookEventId: string,
    processingStatus: PaymentWebhookProcessingStatus,
  ): Promise<void> {
    await this.prisma.paymentWebhookEvent.update({
      where: { webhookEventId },
      data: {
        processingStatus,
        processedAt: new Date(),
        processingError: null,
      },
    });
  }

  private async failEvent(
    webhookEventId: string,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : 'Unknown Stripe webhook error';
    await this.prisma.paymentWebhookEvent.update({
      where: { webhookEventId },
      data: {
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        processingError: message.slice(0, MAX_ERROR_LENGTH),
      },
    });
  }
}

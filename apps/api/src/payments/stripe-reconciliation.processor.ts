import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PaymentProviderType,
  PaymentRefundStatus,
  PaymentTransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { StripeConfigService } from './stripe.config';
import { StripeWebhookService } from './stripe-webhook.service';

const RECONCILED_CODE = 'STRIPE_SESSION_RECONCILED';

@Injectable()
export class StripeReconciliationProcessor {
  private readonly logger = new Logger(StripeReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: StripeConfigService,
    private readonly stripeAdapter: StripeAdapter,
    private readonly webhookService: StripeWebhookService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async reconcileExpiredSessions(): Promise<void> {
    if (!this.config.isSandbox()) {
      return;
    }

    const expiredPayments = await this.prisma.paymentTransaction.findMany({
      where: {
        provider: PaymentProviderType.STRIPE,
        status: {
          in: [
            PaymentTransactionStatus.EXPIRED,
            PaymentTransactionStatus.CANCELLED,
          ],
        },
        providerOrderId: { not: null },
        OR: [{ failureCode: null }, { failureCode: { not: RECONCILED_CODE } }],
      },
      orderBy: { expiresAt: 'asc' },
      take: 25,
      select: { paymentId: true, providerOrderId: true },
    });

    for (const payment of expiredPayments) {
      if (!payment.providerOrderId?.startsWith('cs_')) {
        await this.markSessionReconciled(payment.paymentId);
        continue;
      }

      try {
        const evidence = await this.stripeAdapter.queryEvidence(
          payment.providerOrderId,
        );
        if (evidence.status === 'SUCCEEDED') {
          await this.webhookService.processEvidence(evidence);
        } else {
          await this.stripeAdapter.expireSession(payment.providerOrderId);
          await this.markSessionReconciled(payment.paymentId);
        }
      } catch (error: unknown) {
        this.logger.error(
          `Stripe reconciliation failed for payment ${payment.paymentId}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    const pendingRefunds = await this.prisma.paymentRefund.findMany({
      where: {
        status: PaymentRefundStatus.PENDING,
        payment: {
          provider: PaymentProviderType.STRIPE,
          status: PaymentTransactionStatus.REFUND_PENDING,
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 25,
      select: { paymentId: true },
    });

    for (const refund of pendingRefunds) {
      try {
        await this.webhookService.retryPendingRefund(refund.paymentId);
      } catch (error: unknown) {
        this.logger.error(
          `Stripe refund reconciliation failed for payment ${refund.paymentId}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async markSessionReconciled(paymentId: string): Promise<void> {
    await this.prisma.paymentTransaction.updateMany({
      where: {
        paymentId,
        status: {
          in: [
            PaymentTransactionStatus.EXPIRED,
            PaymentTransactionStatus.CANCELLED,
          ],
        },
      },
      data: {
        failureCode: RECONCILED_CODE,
        failureMessage: 'Expired local Stripe Checkout Session was reconciled.',
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PaymentTransaction } from '@prisma/client';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { VerifiedPaymentResult } from '../interfaces/payment-provider.interface';
import { StripeConfigService } from '../stripe.config';

export interface StripePaymentEvidence {
  paymentId: string;
  orderId: string;
  providerOrderId: string;
  providerTransactionId: string;
  providerEventId: string;
  eventType: string;
  amountMinor: bigint;
  currency: string;
  status: 'SUCCEEDED' | 'FAILED';
  checkoutStatus: string;
  paidAt: Date;
  payloadHash: string;
}

export interface StripeRefundResult {
  providerRefundId: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
}

@Injectable()
export class StripeAdapter {
  private readonly stripe: Stripe | null;

  constructor(private readonly config: StripeConfigService) {
    // Use the API version bundled with the installed Stripe SDK. Pinning a
    // stale, casted version can desynchronise the SDK types and runtime API.
    this.stripe = config.isSandbox() ? new Stripe(config.secretKey) : null;
  }

  async createPayment(
    payment: PaymentTransaction,
    orderCode: string,
  ): Promise<{ paymentUrl: string; providerOrderId: string }> {
    if (this.config.isSimulated()) {
      return {
        paymentUrl: `${this.config.frontendUrl}/payments/return/mock?paymentId=${payment.paymentId}&provider=STRIPE`,
        providerOrderId: `SIM-STRIPE-${payment.paymentId}`,
      };
    }

    const currency = payment.requestCurrency.trim().toUpperCase();
    if (currency !== 'VND') {
      throw new Error('Stripe is configured to accept VND payments only.');
    }

    const session = await this.requireClient().checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Thanh toán đơn hàng ${orderCode}`,
              },
              // VND is a zero-decimal currency in Stripe.
              unit_amount: this.toSafePositiveNumber(
                payment.requestAmountMinor,
              ),
            },
            quantity: 1,
          },
        ],
        client_reference_id: payment.paymentId,
        metadata: {
          paymentId: payment.paymentId,
          orderId: payment.orderId,
        },
        payment_intent_data: {
          metadata: {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
          },
        },
        success_url: `${this.config.frontendUrl}/payments/return/stripe?paymentId=${payment.paymentId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.config.frontendUrl}/cart`,
        // Stripe Checkout requires at least 30 minutes. The local reservation
        // remains authoritative and the reconciliation worker closes it earlier.
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      },
      { idempotencyKey: payment.idempotencyKey },
    );

    if (!session.url) {
      throw new Error('Stripe did not return a Checkout URL.');
    }

    return { paymentUrl: session.url, providerOrderId: session.id };
  }

  verifyWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!rawBody.length) {
      throw new Error('Stripe webhook raw body is empty.');
    }
    return this.requireClient().webhooks.constructEvent(
      rawBody,
      signature,
      this.config.webhookSecret,
    );
  }

  parseWebhookEvent(
    event: Stripe.Event,
    rawBody: Buffer,
  ): StripePaymentEvidence | null {
    if (event.type !== 'checkout.session.completed') {
      return null;
    }

    return this.toEvidence(
      event.data.object,
      event.id,
      event.type,
      new Date(event.created * 1000),
      this.sha256(rawBody),
    );
  }

  async queryEvidence(providerOrderId: string): Promise<StripePaymentEvidence> {
    const session = await this.requireClient().checkout.sessions.retrieve(
      providerOrderId,
      { expand: ['payment_intent'] },
    );
    const serialized = JSON.stringify(session);
    const payloadHash = this.sha256(serialized);
    return this.toEvidence(
      session,
      `query:${session.id}:${session.status}:${session.payment_status}`,
      'stripe.checkout.session.query',
      new Date(),
      payloadHash,
    );
  }

  async expireSession(providerOrderId: string): Promise<void> {
    const stripe = this.requireClient();
    const session = await stripe.checkout.sessions.retrieve(providerOrderId);
    if (session.status === 'open') {
      await stripe.checkout.sessions.expire(providerOrderId);
    }
  }

  async refundPayment(
    paymentIntentId: string,
    idempotencyKey: string,
    paymentId: string,
  ): Promise<StripeRefundResult> {
    const refund = await this.requireClient().refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: { paymentId },
      },
      { idempotencyKey },
    );

    const status = refund.status ?? 'pending';
    return {
      providerRefundId: refund.id,
      status:
        status === 'succeeded'
          ? 'SUCCEEDED'
          : status === 'failed' || status === 'canceled'
            ? 'FAILED'
            : 'PENDING',
    };
  }

  // Kept for compatibility with the current provider interface and diagnostics.
  verifyAndParseNotification(event: Stripe.Event): VerifiedPaymentResult {
    const evidence = this.parseWebhookEvent(
      event,
      Buffer.from(JSON.stringify(event)),
    );
    return evidence
      ? {
          providerTransactionId: evidence.providerTransactionId,
          amountPaid: Number(evidence.amountMinor),
          currency: evidence.currency,
          status: evidence.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILED',
        }
      : {
          providerTransactionId: '',
          amountPaid: 0,
          currency: '',
          status: 'FAILED',
        };
  }

  async queryStatus(providerOrderId: string): Promise<VerifiedPaymentResult> {
    const evidence = await this.queryEvidence(providerOrderId);
    return {
      providerTransactionId: evidence.providerTransactionId,
      amountPaid: Number(evidence.amountMinor),
      currency: evidence.currency,
      status: evidence.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILED',
    };
  }

  private toEvidence(
    session: Stripe.Checkout.Session,
    providerEventId: string,
    eventType: string,
    paidAt: Date,
    payloadHash: string,
  ): StripePaymentEvidence {
    if (session.object !== 'checkout.session' || session.mode !== 'payment') {
      throw new Error(
        'Stripe event does not contain a payment Checkout Session.',
      );
    }

    const paymentId = this.requiredMetadata(session, 'paymentId');
    const orderId = this.requiredMetadata(session, 'orderId');
    if (session.client_reference_id !== paymentId) {
      throw new Error(
        'Stripe client_reference_id does not match payment metadata.',
      );
    }
    if (!this.isUuid(paymentId) || !this.isUuid(orderId)) {
      throw new Error('Stripe metadata contains an invalid local identifier.');
    }
    if (!session.id || !providerEventId) {
      throw new Error('Stripe response is missing an event or session ID.');
    }

    const amountMinor = BigInt(session.amount_total ?? 0);
    const currency = (session.currency ?? '').trim().toUpperCase();
    if (amountMinor <= 0n || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error(
        'Stripe response contains an invalid amount or currency.',
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    const succeeded =
      session.payment_status === 'paid' && session.status === 'complete';
    if (succeeded && !paymentIntentId) {
      throw new Error('Paid Stripe session is missing a PaymentIntent ID.');
    }

    return {
      paymentId,
      orderId,
      providerOrderId: session.id,
      providerTransactionId: paymentIntentId || session.id,
      providerEventId,
      eventType,
      amountMinor,
      currency,
      status: succeeded ? 'SUCCEEDED' : 'FAILED',
      checkoutStatus: session.status ?? 'unknown',
      paidAt,
      payloadHash,
    };
  }

  private requiredMetadata(
    session: Stripe.Checkout.Session,
    field: 'paymentId' | 'orderId',
  ): string {
    const value = session.metadata?.[field]?.trim();
    if (!value) {
      throw new Error(`Stripe session metadata is missing ${field}.`);
    }
    return value;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private toSafePositiveNumber(value: bigint): number {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Stripe amount is outside the safe integer range.');
    }
    return amount;
  }

  private sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private requireClient(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe API is unavailable in SIMULATED mode.');
    }
    return this.stripe;
  }
}

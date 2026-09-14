import { PaymentTransactionStatus, PaymentProviderType } from '@prisma/client';
import Stripe from 'stripe';
import { StripeAdapter } from './stripe.adapter';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

describe('StripeAdapter', () => {
  const sandboxConfig = (webhookSecret = 'whsec_test_stripe') =>
    ({
      isSandbox: () => true,
      isSimulated: () => false,
      secretKey: 'sk_test_placeholder',
      webhookSecret,
      frontendUrl: 'https://frontend.example.test',
    }) as any;

  it('creates a network-free simulated session', async () => {
    const adapter = new StripeAdapter({
      isSandbox: () => false,
      isSimulated: () => true,
      frontendUrl: 'http://localhost:3000',
    } as any);

    await expect(
      adapter.createPayment(
        {
          paymentId: PAYMENT_ID,
          orderId: ORDER_ID,
        } as any,
        'ORD-TEST',
      ),
    ).resolves.toEqual({
      paymentUrl: `http://localhost:3000/payments/return/mock?paymentId=${PAYMENT_ID}&provider=STRIPE`,
      providerOrderId: `SIM-STRIPE-${PAYMENT_ID}`,
    });
  });

  it('uses the persisted VND minor amount and local idempotency key', async () => {
    const adapter = new StripeAdapter(sandboxConfig());
    const create = jest.fn().mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/c/pay/cs_test_1',
    });
    (adapter as any).stripe = { checkout: { sessions: { create } } };

    await adapter.createPayment(
      {
        paymentId: PAYMENT_ID,
        orderId: ORDER_ID,
        provider: PaymentProviderType.STRIPE,
        status: PaymentTransactionStatus.CREATED,
        requestAmountMinor: 192_000n,
        requestCurrency: 'VND',
        idempotencyKey: 'IDEM-LOCAL-1',
      } as any,
      'ORD-TEST',
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: PAYMENT_ID,
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'vnd',
              unit_amount: 192_000,
            }),
          }),
        ],
        metadata: { paymentId: PAYMENT_ID, orderId: ORDER_ID },
      }),
      { idempotencyKey: 'IDEM-LOCAL-1' },
    );
  });

  it('verifies the unchanged raw body and parses bound payment evidence', () => {
    const now = Math.floor(Date.now() / 1000);
    const secret = 'whsec_test_stripe';
    const adapter = new StripeAdapter(sandboxConfig(secret));
    const rawBody = Buffer.from(
      JSON.stringify({
        id: 'evt_test_1',
        object: 'event',
        created: now,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            object: 'checkout.session',
            mode: 'payment',
            status: 'complete',
            payment_status: 'paid',
            amount_total: 192000,
            currency: 'vnd',
            client_reference_id: PAYMENT_ID,
            metadata: { paymentId: PAYMENT_ID, orderId: ORDER_ID },
            payment_intent: 'pi_test_1',
          },
        },
      }),
    );
    const stripe = new Stripe('sk_test_placeholder');
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: rawBody.toString('utf8'),
      secret,
      timestamp: now,
    });

    const event = adapter.verifyWebhookEvent(rawBody, signature);
    expect(adapter.parseWebhookEvent(event, rawBody)).toEqual(
      expect.objectContaining({
        paymentId: PAYMENT_ID,
        orderId: ORDER_ID,
        providerOrderId: 'cs_test_1',
        providerTransactionId: 'pi_test_1',
        amountMinor: 192_000n,
        currency: 'VND',
        status: 'SUCCEEDED',
      }),
    );
    expect(() =>
      adapter.verifyWebhookEvent(Buffer.from('{}'), signature),
    ).toThrow();
  });

  it('rejects metadata that is not bound to client_reference_id', () => {
    const adapter = new StripeAdapter(sandboxConfig());
    const event = {
      id: 'evt_test_2',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_test_2',
          object: 'checkout.session',
          mode: 'payment',
          status: 'complete',
          payment_status: 'paid',
          amount_total: 192000,
          currency: 'vnd',
          client_reference_id: '33333333-3333-4333-8333-333333333333',
          metadata: { paymentId: PAYMENT_ID, orderId: ORDER_ID },
          payment_intent: 'pi_test_2',
        },
      },
    } as unknown as Stripe.Event;

    expect(() => adapter.parseWebhookEvent(event, Buffer.from('{}'))).toThrow(
      'client_reference_id',
    );
  });

  it('creates an idempotent refund bound to the local payment', async () => {
    const adapter = new StripeAdapter(sandboxConfig());
    const create = jest.fn().mockResolvedValue({
      id: 're_test_1',
      status: 'succeeded',
    });
    (adapter as any).stripe = { refunds: { create } };

    await expect(
      adapter.refundPayment(
        'pi_test_1',
        `STRIPE-LATE-${PAYMENT_ID}`,
        PAYMENT_ID,
      ),
    ).resolves.toEqual({
      providerRefundId: 're_test_1',
      status: 'SUCCEEDED',
    });
    expect(create).toHaveBeenCalledWith(
      {
        payment_intent: 'pi_test_1',
        metadata: { paymentId: PAYMENT_ID },
      },
      { idempotencyKey: `STRIPE-LATE-${PAYMENT_ID}` },
    );
  });
});

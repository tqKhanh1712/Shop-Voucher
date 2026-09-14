import {
  PaymentProviderType,
  PaymentTransaction,
  PaymentTransactionStatus,
  Prisma,
} from '@prisma/client';
import { MomoAdapter } from './momo.adapter';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';

describe('MomoAdapter', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.MOMO_PARTNER_CODE = 'TEST_PARTNER';
    process.env.MOMO_ACCESS_KEY = 'TEST_ACCESS';
    process.env.MOMO_SECRET_KEY = 'TEST_SECRET';
    process.env.MOMO_API_URL = 'https://momo.test/create';
    process.env.MOMO_RETURN_URL = 'http://localhost:3000/payments/return/momo';
    process.env.MOMO_NOTIFY_URL = 'https://api.test/payments/momo/ipn';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('uses the payment id for MoMo order and return reconciliation', async () => {
    let capturedRequest: RequestInit | undefined;
    const fetchImplementation: typeof fetch = (_input, init) => {
      capturedRequest = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            resultCode: 0,
            payUrl: 'https://momo.test/pay',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    };
    const fetchMock = jest.fn(fetchImplementation);
    global.fetch = fetchMock;

    const adapter = new MomoAdapter();
    const now = new Date('2026-08-27T00:00:00.000Z');
    const payment: PaymentTransaction = {
      paymentId: PAYMENT_ID,
      orderId: '22222222-2222-4222-8222-222222222222',
      provider: PaymentProviderType.MOMO,
      attemptNo: 1,
      status: PaymentTransactionStatus.CREATED,
      idempotencyKey: 'momo-test-attempt-1',
      providerOrderId: null,
      providerTransactionId: null,
      baseAmount: new Prisma.Decimal(199000),
      requestAmountMinor: 199000n,
      requestCurrency: 'VND',
      settledAmountMinor: null,
      settledCurrency: null,
      exchangeRate: null,
      failureCode: null,
      failureMessage: null,
      expiresAt: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await adapter.createPayment(payment, 'ORD-TEST');

    expect(result).toEqual({
      paymentUrl: 'https://momo.test/pay',
      providerOrderId: PAYMENT_ID,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://momo.test/create',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    if (typeof capturedRequest?.body !== 'string') {
      throw new Error('Expected a JSON request body.');
    }
    const body = JSON.parse(capturedRequest.body) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        orderId: PAYMENT_ID,
        requestId: PAYMENT_ID,
        requestType: 'payWithATM',
        redirectUrl: 'http://localhost:3000/payments/return/momo',
        ipnUrl: 'https://api.test/payments/momo/ipn',
      }),
    );
    expect(body.signature).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
  });
});

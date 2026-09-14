import * as crypto from 'crypto';
import { PaymentTransaction } from '@prisma/client';
import { ZaloPayAdapter } from './zalopay.adapter';
import { ZaloPayConfigService } from '../zalopay.config';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';

describe('ZaloPayAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ZALOPAY_APP_ID: '553',
      ZALOPAY_KEY1: 'key-1',
      ZALOPAY_KEY2: 'key-2',
      ZALOPAY_CALLBACK_URL: 'https://api.example.test/payments/zalopay/callback',
      ZALOPAY_REDIRECT_URL: 'http://localhost:3000/payments/return/zalopay',
      ZALOPAY_API_URL: 'https://sb-openapi.zalopay.vn/v2/create',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function adapter() {
    return new ZaloPayAdapter(new ZaloPayConfigService());
  }

  function payment(): PaymentTransaction {
    return {
      paymentId: PAYMENT_ID,
      requestAmountMinor: 150_000n,
      requestCurrency: 'VND',
    } as PaymentTransaction;
  }

  it('creates a signed ZaloPay Sandbox order and returns its gateway URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        return_code: 1,
        order_url: 'https://sbgateway.zalopay.vn/openinapp?order=test',
      }),
    } as Response);

    const result = await adapter().createPayment(payment(), 'ORD-TEST');

    expect(result.paymentUrl).toContain('sbgateway.zalopay.vn');
    expect(result.providerOrderId).toMatch(/^\d{6}_[a-f0-9]{32}$/);
    const [, request] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(String(request?.body));
    expect(body.get('app_id')).toBe('553');
    expect(body.get('amount')).toBe('150000');
    expect(body.get('callback_url')).toBe(
      'https://api.example.test/payments/zalopay/callback',
    );
    expect(JSON.parse(body.get('embed_data') || '{}')).toEqual({
      redirecturl: `http://localhost:3000/payments/return/zalopay?paymentId=${PAYMENT_ID}`,
    });

    const signedData = [
      body.get('app_id'),
      body.get('app_trans_id'),
      body.get('app_user'),
      body.get('amount'),
      body.get('app_time'),
      body.get('embed_data'),
      body.get('item'),
    ].join('|');
    expect(body.get('mac')).toBe(
      crypto.createHmac('sha256', 'key-1').update(signedData).digest('hex'),
    );
  });

  it('accepts only callbacks signed with Key2', async () => {
    const data = JSON.stringify({
      app_trans_id: '240101_abc',
      amount: 150000,
      zp_trans_id: 240101000000001,
    });
    const mac = crypto.createHmac('sha256', 'key-2').update(data).digest('hex');

    await expect(
      adapter().verifyAndParseNotification({ data, mac }),
    ).resolves.toMatchObject({
      signatureValid: true,
      status: 'SUCCESS',
      transactionReference: '240101_abc',
      providerTransactionId: '240101000000001',
      amountMinor: 150000n,
      currency: 'VND',
    });

    await expect(
      adapter().verifyAndParseNotification({ data, mac: 'a'.repeat(64) }),
    ).resolves.toMatchObject({ signatureValid: false, status: 'FAILED' });
  });
});

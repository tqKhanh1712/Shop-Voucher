import { BadRequestException } from '@nestjs/common';
import { PaymentProviderType } from '@prisma/client';
import { PaymentsController } from './payments.controller';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

describe('PaymentsController Stripe boundaries', () => {
  function harness() {
    const payment = {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      provider: PaymentProviderType.STRIPE,
      order: { orderCode: 'ORD-TEST' },
    };
    const payments = {
      createPaymentAttempt: jest.fn().mockResolvedValue(payment),
      bindStripeSession: jest.fn().mockResolvedValue({}),
      getPaymentDetailsForActor: jest.fn().mockResolvedValue(payment),
    };
    const stripe = {
      createPayment: jest.fn().mockResolvedValue({
        paymentUrl: 'https://checkout.stripe.test/c/pay/cs_test_1',
        providerOrderId: 'cs_test_1',
      }),
      expireSession: jest.fn(),
      verifyWebhookEvent: jest.fn().mockReturnValue({ id: 'evt_test_1' }),
    };
    const stripeWebhook = {
      processEvent: jest.fn().mockResolvedValue({ received: true }),
    };
    const controller = new PaymentsController(
      payments as any,
      {} as any,
      {} as any,
      stripe as any,
      {} as any,
      {} as any,
      stripeWebhook as any,
      { isSimulated: () => true } as any,
    );
    return { payment, payments, stripe, stripeWebhook, controller };
  }

  it('persists the Stripe Session binding before returning its URL', async () => {
    const { controller, payments } = harness();

    await expect(
      controller.createPaymentAttempt(
        { user: { userId: 'customer-1' } } as any,
        ORDER_ID,
        { provider: PaymentProviderType.STRIPE },
      ),
    ).resolves.toEqual({
      paymentId: PAYMENT_ID,
      provider: PaymentProviderType.STRIPE,
      paymentUrl: 'https://checkout.stripe.test/c/pay/cs_test_1',
    });
    expect(payments.bindStripeSession).toHaveBeenCalledWith(
      PAYMENT_ID,
      'cs_test_1',
    );
  });

  it('returns a real 400 error when the Stripe signature is invalid', async () => {
    const { controller, stripe, stripeWebhook } = harness();
    stripe.verifyWebhookEvent.mockImplementation(() => {
      throw new Error('signature mismatch');
    });

    await expect(
      controller.handleStripeWebhook({
        headers: { 'stripe-signature': 'invalid' },
        rawBody: Buffer.from('{}'),
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(stripeWebhook.processEvent).not.toHaveBeenCalled();
  });

  it('passes the verified event and unchanged raw body to the processor', async () => {
    const { controller, stripeWebhook } = harness();
    const rawBody = Buffer.from('{"id":"evt_test_1"}');

    await controller.handleStripeWebhook({
      headers: { 'stripe-signature': 'valid' },
      rawBody,
    } as any);

    expect(stripeWebhook.processEvent).toHaveBeenCalledWith(
      { id: 'evt_test_1' },
      rawBody,
    );
  });

  it('checks payment ownership before allowing a simulated success', async () => {
    const { controller, payments } = harness();
    (controller as any).paymentFinalizationService = {
      finalizePayment: jest.fn().mockResolvedValue({
        orderId: ORDER_ID,
        orderCode: 'ORD-TEST',
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
      }),
    };
    const user = { userId: 'customer-1', role: 'CUSTOMER' };

    await controller.mockSuccess({ user } as any, PAYMENT_ID);

    expect(payments.getPaymentDetailsForActor).toHaveBeenCalledWith(
      PAYMENT_ID,
      user,
    );
  });
});

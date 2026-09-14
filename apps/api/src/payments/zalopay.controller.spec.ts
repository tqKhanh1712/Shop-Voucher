import {
  PaymentProviderType,
  PaymentTransactionStatus,
} from '@prisma/client';
import { PaymentsController } from './payments.controller';

describe('PaymentsController ZaloPay callback boundaries', () => {
  const payment = {
    paymentId: '11111111-1111-4111-8111-111111111111',
    provider: PaymentProviderType.ZALOPAY,
    providerOrderId: '240101_abc',
    requestAmountMinor: 150_000n,
    requestCurrency: 'VND',
    status: PaymentTransactionStatus.PENDING,
  };

  function harness() {
    const payments = {
      getPaymentByProviderOrderId: jest.fn().mockResolvedValue(payment),
    };
    const finalization = { finalizePayment: jest.fn().mockResolvedValue({}) };
    const zaloPay = {
      verifyAndParseNotification: jest.fn().mockResolvedValue({
        signatureValid: true,
        transactionReference: payment.providerOrderId,
        providerTransactionId: '240101000000001',
        amountMinor: payment.requestAmountMinor,
        currency: 'VND',
      }),
    };
    const controller = new PaymentsController(
      payments as never,
      finalization as never,
      zaloPay as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { controller, payments, finalization, zaloPay };
  }

  it('finalizes a valid signed callback once', async () => {
    const { controller, finalization } = harness();

    await expect(controller.handleZaloPayCallback({})).resolves.toEqual({
      return_code: 1,
      return_message: 'success',
    });
    expect(finalization.finalizePayment).toHaveBeenCalledWith(
      payment.paymentId,
      '240101000000001',
    );
  });

  it('rejects an invalid callback before querying or finalizing a payment', async () => {
    const { controller, payments, finalization, zaloPay } = harness();
    zaloPay.verifyAndParseNotification.mockResolvedValue({ signatureValid: false });

    await expect(controller.handleZaloPayCallback({})).resolves.toEqual({
      return_code: -1,
      return_message: 'invalid mac',
    });
    expect(payments.getPaymentByProviderOrderId).not.toHaveBeenCalled();
    expect(finalization.finalizePayment).not.toHaveBeenCalled();
  });
});

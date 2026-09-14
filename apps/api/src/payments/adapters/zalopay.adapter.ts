import { Injectable } from '@nestjs/common';
import { PaymentTransaction } from '@prisma/client';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  VerifiedPaymentResult,
} from '../interfaces/payment-provider.interface';
import { ZaloPayConfigService } from '../zalopay.config';

interface ZaloPayCreateOrderResponse {
  return_code: number;
  return_message?: string;
  order_url?: string;
}

interface ZaloPayCallbackData {
  app_trans_id?: unknown;
  amount?: unknown;
  zp_trans_id?: unknown;
}

@Injectable()
export class ZaloPayAdapter implements PaymentProvider {
  constructor(private readonly config: ZaloPayConfigService) {}

  async createPayment(
    payment: PaymentTransaction,
    orderCode: string,
  ): Promise<{ paymentUrl: string; providerOrderId: string }> {
    this.config.assertConfigured();
    if (payment.requestCurrency !== 'VND') {
      throw new Error('ZaloPay only supports VND in this integration.');
    }

    const appTransId = this.createAppTransId(payment.paymentId);
    const redirectUrl = new URL(this.config.redirectUrl);
    redirectUrl.searchParams.set('paymentId', payment.paymentId);
    const embedData = JSON.stringify({ redirecturl: redirectUrl.toString() });
    const item = '[]';
    const amount = Number(payment.requestAmountMinor);
    const appTime = Date.now();
    const dataToSign = [
      this.config.appId,
      appTransId,
      'VoucherNow',
      amount,
      appTime,
      embedData,
      item,
    ].join('|');
    const mac = crypto
      .createHmac('sha256', this.config.key1)
      .update(dataToSign, 'utf8')
      .digest('hex');

    const payload = new URLSearchParams({
      app_id: this.config.appId.toString(),
      app_trans_id: appTransId,
      app_user: 'VoucherNow',
      app_time: appTime.toString(),
      amount: amount.toString(),
      embed_data: embedData,
      item,
      description: `Thanh toan don hang ${orderCode}`.slice(0, 100),
      callback_url: this.config.callbackUrl,
      mac,
    });

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    });
    const result = (await response.json()) as ZaloPayCreateOrderResponse;
    if (!response.ok || result.return_code !== 1 || !result.order_url) {
      throw new Error(
        `ZaloPay Create Order failed: ${result.return_message || `HTTP ${response.status}`}`,
      );
    }

    return { paymentUrl: result.order_url, providerOrderId: appTransId };
  }

  async verifyAndParseNotification(
    requestBody: Record<string, unknown>,
  ): Promise<VerifiedPaymentResult> {
    this.config.assertConfigured();
    const data = requestBody.data;
    const receivedMac = requestBody.mac;
    if (typeof data !== 'string' || typeof receivedMac !== 'string') {
      return this.invalidNotification();
    }

    const expectedMac = crypto
      .createHmac('sha256', this.config.key2)
      .update(data, 'utf8')
      .digest('hex');
    const signatureValid = this.safeEqual(expectedMac, receivedMac);

    let callback: ZaloPayCallbackData;
    try {
      callback = JSON.parse(data) as ZaloPayCallbackData;
    } catch {
      return this.invalidNotification();
    }

    const amount = Number(callback.amount);
    return {
      providerTransactionId:
        callback.zp_trans_id === undefined ? '' : String(callback.zp_trans_id),
      amountPaid: Number.isFinite(amount) ? amount : -1,
      amountMinor: Number.isFinite(amount) ? BigInt(amount) : -1n,
      currency: 'VND',
      status: signatureValid ? 'SUCCESS' : 'FAILED',
      signatureValid,
      transactionReference:
        typeof callback.app_trans_id === 'string' ? callback.app_trans_id : '',
    };
  }

  queryStatus(): Promise<VerifiedPaymentResult> {
    return Promise.reject(
      new Error('ZaloPay query API is not configured for this basic Sandbox flow.'),
    );
  }

  private createAppTransId(paymentId: string): string {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => part.value)
      .join('');
    return `${date}_${paymentId.replace(/-/g, '')}`;
  }

  private safeEqual(expected: string, received: string): boolean {
    if (!/^[a-fA-F0-9]{64}$/.test(received)) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex'),
    );
  }

  private invalidNotification(): VerifiedPaymentResult {
    return {
      providerTransactionId: '',
      amountPaid: -1,
      amountMinor: -1n,
      currency: '',
      status: 'FAILED',
      signatureValid: false,
      transactionReference: '',
    };
  }
}

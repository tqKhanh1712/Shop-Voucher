import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, VerifiedPaymentResult } from '../interfaces/payment-provider.interface';
import { PaymentTransaction } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class MomoAdapter implements PaymentProvider {
  private readonly logger = new Logger(MomoAdapter.name);
  
  // Mặc định dùng Test Credentials của MoMo nếu chưa có trong .env
  // Lấy credentials và loại bỏ dấu ngoặc kép (nếu có do lỗi parse .env)
  private readonly partnerCode = (process.env.MOMO_PARTNER_CODE || 'MOMOBKUN20180529').replace(/['"]/g, '').trim();
  private readonly accessKey = (process.env.MOMO_ACCESS_KEY || 'klm05TvNBzhg7h7j').replace(/['"]/g, '').trim();
  private readonly secretKey = (process.env.MOMO_SECRET_KEY || 'at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa').replace(/['"]/g, '').trim();
  private readonly apiUrl = (process.env.MOMO_API_URL || 'https://test-payment.momo.vn/v2/gateway/api/create').replace(/['"]/g, '').trim();
  private readonly returnUrl = (process.env.MOMO_RETURN_URL || 'http://localhost:3000/payments/return/momo').replace(/['"]/g, '').trim();
  private readonly notifyUrl = (process.env.MOMO_NOTIFY_URL || 'https://webhook.site/placeholder-momo-ipn').replace(/['"]/g, '').trim();

  async createPayment(
    payment: PaymentTransaction,
    orderCode: string,
  ): Promise<{ paymentUrl: string; providerOrderId?: string }> {
    const amountVal = Math.round(Number(payment.baseAmount)).toString();
    const requestId = payment.paymentId;
    const orderId = payment.paymentId; // Dùng paymentId làm orderId đối với MoMo để tránh trùng lặp giữa các attempt
    const orderInfo = `Thanh toan don hang ${orderCode}`;
    const redirectUrl = this.returnUrl;
    const ipnUrl = this.notifyUrl;
    const requestType = 'payWithATM';
    const extraData = '';

    const rawSignature = `accessKey=${this.accessKey}&amount=${amountVal}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'Test Partner',
      storeId: 'MomoTestStore',
      requestId: requestId,
      amount: Number(amountVal),
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: redirectUrl,
      ipnUrl: ipnUrl,
      lang: 'vi',
      requestType: requestType,
      autoCapture: true,
      extraData: extraData,
      signature: signature,
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (responseData.resultCode === 0 && responseData.payUrl) {
        return {
          paymentUrl: responseData.payUrl,
          providerOrderId: orderId, // Lưu orderId của MoMo để đối chiếu
        };
      } else {
        this.logger.error('Lỗi tạo thanh toán MoMo:', responseData);
        throw new Error(`MoMo Error: ${responseData.message}`);
      }
    } catch (error) {
      this.logger.error('Lỗi kết nối tới MoMo API:', error);
      throw error;
    }
  }

  async verifyAndParseNotification(reqBody: any): Promise<VerifiedPaymentResult> {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = reqBody;

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    this.logger.log(`[MOMO IPN] Received Signature: ${signature}`);
    this.logger.log(`[MOMO IPN] Expected Signature: ${expectedSignature}`);
    this.logger.log(`[MOMO IPN] Raw Signature String: ${rawSignature}`);

    const isValid = expectedSignature === signature;

    if (!isValid) {
      this.logger.error('[MOMO IPN] LỖI: Chữ ký IPN MoMo không hợp lệ!');
    } else {
      this.logger.log('MOMO IPN SUCCESS:', reqBody.orderId);
    }

    return {
      providerTransactionId: transId ? transId.toString() : 'MOCK-MOMO-TX',
      amountPaid: Number(amount),
      currency: 'VND',
      status: isValid && resultCode === 0 ? 'SUCCESS' : 'FAILED',
    };
  }

  async queryStatus(providerOrderId: string): Promise<VerifiedPaymentResult> {
    // Không bắt buộc phải implement cho IPN cơ bản, return mock data
    return {
      providerTransactionId: 'QUERY-MOMO-TX',
      amountPaid: 0,
      currency: 'VND',
      status: 'SUCCESS',
    };
  }
}

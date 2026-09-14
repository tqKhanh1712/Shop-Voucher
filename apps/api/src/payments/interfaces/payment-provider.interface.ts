import { PaymentTransaction } from '@prisma/client';

export interface VerifiedPaymentResult {
  providerTransactionId: string;
  amountPaid: number;
  amountMinor?: bigint;
  currency: string;
  status: 'SUCCESS' | 'FAILED';
  signatureValid?: boolean;
  responseCode?: string;
  transactionStatus?: string;
  transactionReference?: string;
  bankCode?: string;
  payDate?: string;
}

export interface PaymentProvider {
  /**
   * Tạo phiên thanh toán hoặc lấy URL thanh toán từ nhà cung cấp.
   */
  createPayment(
    payment: PaymentTransaction,
    orderCode: string,
    clientIp?: string,
  ): Promise<{ paymentUrl: string; providerOrderId?: string }>;

  /**
   * Xác thực và phân tích phản hồi webhook hoặc IPN từ nhà cung cấp.
   */
  verifyAndParseNotification(req: any): Promise<VerifiedPaymentResult>;

  /**
   * Truy vấn trạng thái giao dịch trực tiếp từ API của nhà cung cấp.
   */
  queryStatus(providerOrderId: string): Promise<VerifiedPaymentResult>;
}

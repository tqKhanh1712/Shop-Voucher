import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentProviderType,
  PaymentTransactionStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Khởi tạo giao dịch thanh toán mới cho đơn hàng (Payment Attempt).
   * @param customerId ID khách hàng thực hiện thanh toán
   * @param orderId ID đơn hàng cần thanh toán
   * @param provider Loại cổng thanh toán (STRIPE, PAYPAL, ZALOPAY, MOMO)
   */
  async createPaymentAttempt(
    customerId: string,
    orderId: string,
    provider: PaymentProviderType,
  ) {
    const ownedOrder = await this.prisma.order.findFirst({
      where: { orderId, customerId },
      select: { orderId: true },
    });

    if (!ownedOrder) {
      throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${orderId}::uuid
        FOR UPDATE
      `;

      const order = await tx.order.findFirst({
        where: { orderId, customerId },
        include: { paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
      }

      // Bước 2: Ràng buộc trạng thái đơn hàng (chỉ thanh toán đơn PENDING và UNPAID)
      if (
        order.orderStatus !== OrderStatus.PENDING ||
        order.paymentStatus !== PaymentStatus.UNPAID
      ) {
        throw new BadRequestException(
          'Đơn hàng này không ở trạng thái chờ thanh toán.',
        );
      }

      // Bước 3: Ràng buộc thời gian giữ chỗ tồn kho (RB-15)
      const now = new Date();
      if (order.reservationExpiresAt <= now) {
        throw new BadRequestException(
          'Thời gian giữ chỗ thanh toán của đơn hàng đã hết hạn. Vui lòng đặt lại đơn mới.',
        );
      }

      // Bước 4: Tính số lượt thử thanh toán (attemptNo)
      const attemptNo = order.paymentTransactions.length + 1;
      const idempotencyKey = `IDEM-${order.orderId}-${attemptNo}-${Date.now()}`;

      // Close every previous open attempt before creating the next one. The
      // database enforces one CREATED/PENDING attempt per order.
      await tx.paymentTransaction.updateMany({
        where: {
          orderId: order.orderId,
          status: {
            in: [
              PaymentTransactionStatus.CREATED,
              PaymentTransactionStatus.PENDING,
            ],
          },
        },
        data: {
          status: PaymentTransactionStatus.CANCELLED,
          failureCode: 'SUPERSEDED',
          failureMessage:
            'Giao dịch cũ bị hủy do khởi tạo lượt thanh toán mới.',
        },
      });

      // Bước 5: Khởi tạo giao dịch thanh toán mới trong DB
      const requestAmountMinor = BigInt(Math.round(Number(order.totalAmount)));

      const payment = await tx.paymentTransaction.create({
        data: {
          orderId: order.orderId,
          provider,
          attemptNo,
          status: PaymentTransactionStatus.CREATED,
          idempotencyKey,
          baseAmount: order.totalAmount,
          requestAmountMinor,
          requestCurrency: 'VND',
          expiresAt: order.reservationExpiresAt,
        },
        include: {
          order: true,
        },
      });

      // Cập nhật cổng thanh toán đang chọn trên đơn hàng
      await tx.order.update({
        where: { orderId: order.orderId },
        data: { selectedPaymentProvider: provider },
      });

      return payment;
    });
  }

  /**
   * Lấy chi tiết trạng thái giao dịch thanh toán để hiển thị giao diện.
   * @param paymentId ID giao dịch thanh toán cục bộ
   */
  async getPaymentDetails(paymentId: string) {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    return payment;
  }

  async getPaymentDetailsForActor(
    paymentId: string,
    actor: { userId: string; role: UserRole },
  ) {
    const payment = await this.getPaymentDetails(paymentId);
    if (
      actor.role !== UserRole.ADMIN &&
      payment.order.customerId !== actor.userId
    ) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    return payment;
  }

  async assertPaymentOwner(
    paymentId: string,
    customerId: string,
  ): Promise<void> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId, order: { customerId } },
      select: { paymentId: true },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }
  }

  async assertPaymentPayable(
    paymentId: string,
    customerId: string,
  ): Promise<void> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId, order: { customerId } },
      include: { order: true },
    });
    const now = new Date();

    if (
      !payment ||
      payment.order.orderStatus !== OrderStatus.PENDING ||
      payment.order.paymentStatus !== PaymentStatus.UNPAID ||
      payment.order.reservationExpiresAt <= now ||
      (payment.expiresAt !== null && payment.expiresAt <= now) ||
      (payment.status !== PaymentTransactionStatus.CREATED &&
        payment.status !== PaymentTransactionStatus.PENDING)
    ) {
      throw new BadRequestException(
        'Đơn hàng đã hết hạn hoặc không còn ở trạng thái chờ thanh toán.',
      );
    }
  }

  /**
   * Cập nhật mã định danh đơn hàng từ cổng thanh toán đối tác (Stripe Session ID, PayPal Order ID, v.v.).
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param providerOrderId ID đơn hàng nhận được từ phía đối tác thanh toán
   * @returns Bản ghi giao dịch thanh toán sau khi cập nhật
   */
  async updateProviderOrderId(paymentId: string, providerOrderId: string) {
    return this.prisma.paymentTransaction.update({
      where: { paymentId },
      data: { providerOrderId },
    });
  }

  async bindZaloPayReference(paymentId: string, transactionReference: string) {
    const activated = await this.prisma.paymentTransaction.updateMany({
      where: {
        paymentId,
        provider: PaymentProviderType.ZALOPAY,
        providerOrderId: null,
        status: PaymentTransactionStatus.CREATED,
      },
      data: {
        providerOrderId: transactionReference,
        status: PaymentTransactionStatus.PENDING,
      },
    });

    if (activated.count !== 1) {
      throw new ConflictException(
        'Payment attempt đã bị thay thế trước khi URL ZaloPay được tạo.',
      );
    }
  }

  async markZaloPayFailed(
    paymentId: string,
    responseCode: string,
    providerTransactionId?: string,
  ): Promise<void> {
    await this.prisma.paymentTransaction.updateMany({
      where: {
        paymentId,
        provider: PaymentProviderType.ZALOPAY,
        status: {
          in: [
            PaymentTransactionStatus.CREATED,
            PaymentTransactionStatus.PENDING,
          ],
        },
      },
      data: {
        status:
          responseCode === '24'
            ? PaymentTransactionStatus.CANCELLED
            : PaymentTransactionStatus.FAILED,
        providerTransactionId: providerTransactionId || undefined,
        failureCode: `ZALOPAY_${responseCode || 'UNKNOWN'}`,
        failureMessage:
          responseCode === '24'
            ? 'Khách hàng hủy giao dịch tại ZaloPay.'
            : 'ZaloPay xác nhận giao dịch không thành công.',
      },
    });
  }

  /**
   * Tìm giao dịch thanh toán theo ID đơn hàng từ phía đối tác (providerOrderId).
   * @param providerOrderId ID đơn hàng của cổng thanh toán
   */
  async getPaymentByProviderOrderId(providerOrderId: string) {
    return this.prisma.paymentTransaction.findFirst({
      where: { providerOrderId },
      include: { order: true },
    });
  }

  /**
   * Đăng ký và lưu sự kiện webhook từ đối tác thanh toán, đảm bảo tính idempotent (chống replay).
   * @param provider Loại cổng thanh toán
   * @param providerEventId ID sự kiện duy nhất từ cổng thanh toán
   * @param eventType Tên loại sự kiện
   * @param payload Dữ liệu payload của webhook
   * @returns True nếu sự kiện được ghi nhận mới, False nếu sự kiện đã tồn tại (bị trùng)
   */
  async registerWebhookEvent(
    provider: PaymentProviderType,
    providerEventId: string,
    eventType: string,
    payload: any,
  ): Promise<boolean> {
    try {
      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider,
          providerEventId,
          eventType,
          signatureValid: true,
          payloadHash,
          processingStatus: 'PROCESSED',
          receivedAt: new Date(),
          processedAt: new Date(),
        },
      });
      return true;
    } catch (err: any) {
      // P2002: Lỗi vi phạm ràng buộc duy nhất (Unique constraint failed) -> Sự kiện trùng lặp
      if (err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  /**
   * Cập nhật trạng thái giao dịch thanh toán thành FAILED với mã lỗi và thông điệp tương ứng.
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param failureCode Mã lỗi thất bại
   * @param failureMessage Chi tiết thông báo thất bại
   */
  async updatePaymentStatusFailed(
    paymentId: string,
    failureCode: string,
    failureMessage: string,
  ) {
    return this.prisma.paymentTransaction.update({
      where: { paymentId },
      data: {
        status: PaymentTransactionStatus.FAILED,
        failureCode,
        failureMessage,
      },
    });
  }

  /**
   * Atomically binds a Stripe Checkout Session to the local attempt and makes
   * that attempt payable. A webhook must never be able to bind itself later.
   */
  async bindStripeSession(paymentId: string, providerOrderId: string) {
    if (!providerOrderId.trim()) {
      throw new BadRequestException('Stripe Session ID không hợp lệ.');
    }

    const activated = await this.prisma.paymentTransaction.updateMany({
      where: {
        paymentId,
        provider: PaymentProviderType.STRIPE,
        providerOrderId: null,
        status: PaymentTransactionStatus.CREATED,
      },
      data: {
        providerOrderId,
        status: PaymentTransactionStatus.PENDING,
        failureCode: null,
        failureMessage: null,
      },
    });

    if (activated.count === 1) {
      return this.prisma.paymentTransaction.findUniqueOrThrow({
        where: { paymentId },
      });
    }

    const existing = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      select: {
        provider: true,
        providerOrderId: true,
        status: true,
      },
    });
    if (
      existing?.provider === PaymentProviderType.STRIPE &&
      existing.providerOrderId === providerOrderId &&
      existing.status === PaymentTransactionStatus.PENDING
    ) {
      return existing;
    }

    throw new ConflictException(
      'Payment attempt đã bị thay thế hoặc hết hạn trước khi Stripe phản hồi.',
    );
  }

  async failStripeSessionCreation(
    paymentId: string,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : 'Unknown Stripe create error';
    await this.prisma.paymentTransaction.updateMany({
      where: {
        paymentId,
        provider: PaymentProviderType.STRIPE,
        status: PaymentTransactionStatus.CREATED,
      },
      data: {
        status: PaymentTransactionStatus.FAILED,
        failureCode: 'STRIPE_SESSION_CREATE_FAILED',
        failureMessage: message.slice(0, 1_000),
      },
    });
  }
}

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  PaymentStatus,
  ReservationStatus,
  PaymentTransactionStatus,
  VoucherCodeStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { EmailService } from './email.service';

@Injectable()
export class PaymentFinalizationService {
  private readonly logger = new Logger(PaymentFinalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Hoàn tất giao dịch thanh toán và phát hành mã voucher (Idempotent).
   * Sử dụng SELECT FOR UPDATE để khóa dòng đơn hàng và các chiến dịch voucher.
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param providerTransactionId ID giao dịch từ cổng thanh toán bên thứ ba (Stripe/PayPal/ZaloPay/MoMo)
   */
  async finalizePayment(
    paymentId: string,
    providerTransactionId: string,
    settlement?: {
      settledAmountMinor: bigint;
      settledCurrency: string;
      exchangeRate?: number;
    },
  ) {
    const paymentReference = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      select: { orderId: true },
    });

    if (!paymentReference) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    const resultOrder = await this.prisma.$transaction(async (tx) => {
      // Luôn khóa Order trước Payment để đồng nhất với luồng hết hạn.
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${paymentReference.orderId}::uuid
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT payment_id FROM "Payment_Transactions"
        WHERE payment_id = ${paymentId}::uuid
        FOR UPDATE
      `;

      const payment = await tx.paymentTransaction.findUnique({
        where: { paymentId },
        include: {
          order: {
            include: {
              orderItems: {
                include: { campaign: true },
                orderBy: { campaignId: 'asc' },
              },
              inventoryReservations: {
                orderBy: { campaignId: 'asc' },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
      }

      const order = payment.order;

      // Replay protection chỉ hợp lệ khi cả payment và order đã hoàn tất nhất quán.
      if (
        payment.status === PaymentTransactionStatus.SUCCEEDED &&
        order.orderStatus === OrderStatus.CONFIRMED &&
        order.paymentStatus === PaymentStatus.PAID
      ) {
        this.logger.log(
          `Giao dịch thanh toán ${paymentId} đã hoàn tất thành công từ trước.`,
        );
        return order;
      }

      const now = new Date();
      if (
        order.orderStatus !== OrderStatus.PENDING ||
        order.paymentStatus !== PaymentStatus.UNPAID ||
        order.reservationExpiresAt <= now ||
        (payment.expiresAt !== null && payment.expiresAt <= now) ||
        (payment.status !== PaymentTransactionStatus.CREATED &&
          payment.status !== PaymentTransactionStatus.PENDING)
      ) {
        throw new BadRequestException(
          'Đơn hàng đã hết hạn hoặc không còn ở trạng thái chờ thanh toán.',
        );
      }

      await tx.$queryRaw`
        SELECT reservation_id FROM "Inventory_Reservations"
        WHERE order_id = ${order.orderId}::uuid
        ORDER BY campaign_id
        FOR UPDATE
      `;

      for (const item of order.orderItems) {
        await tx.$queryRaw`
          SELECT campaign_id FROM "Voucher_Campaigns"
          WHERE campaign_id = ${item.campaignId}::uuid
          FOR UPDATE
        `;
      }

      const reservationsByCampaign = new Map(
        order.inventoryReservations.map((reservation) => [
          reservation.campaignId,
          reservation,
        ]),
      );

      for (const item of order.orderItems) {
        const reservation = reservationsByCampaign.get(item.campaignId);
        if (
          !reservation ||
          reservation.status !== ReservationStatus.ACTIVE ||
          reservation.quantity !== item.quantity
        ) {
          throw new BadRequestException(
            'Phiếu giữ chỗ của đơn hàng không còn hiệu lực.',
          );
        }
      }

      // Chỉ ghi nhận thanh toán sau khi toàn bộ invariant đã được xác thực.
      const settledAmountMinor =
        settlement?.settledAmountMinor ?? payment.requestAmountMinor;
      const settledCurrency =
        settlement?.settledCurrency ?? payment.requestCurrency;
      const exchangeRate = settlement?.exchangeRate ?? null;

      await tx.paymentTransaction.update({
        where: { paymentId },
        data: {
          status: PaymentTransactionStatus.SUCCEEDED,
          providerTransactionId,
          paidAt: now,
          settledAmountMinor,
          settledCurrency,
          exchangeRate,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.CONFIRMED,
        },
      });

      for (const item of order.orderItems) {
        const reservation = reservationsByCampaign.get(item.campaignId)!;
        const committed = await tx.inventoryReservation.updateMany({
          where: {
            reservationId: reservation.reservationId,
            status: ReservationStatus.ACTIVE,
          },
          data: { status: ReservationStatus.COMMITTED },
        });

        if (committed.count !== 1) {
          throw new BadRequestException(
            'Phiếu giữ chỗ của đơn hàng vừa thay đổi trạng thái.',
          );
        }

        const stockCommitted = await tx.voucherCampaign.updateMany({
          where: {
            campaignId: item.campaignId,
            reservedStock: { gte: item.quantity },
          },
          data: {
            reservedStock: { decrement: item.quantity },
            soldQuantity: { increment: item.quantity },
          },
        });

        if (stockCommitted.count !== 1) {
          throw new Error(
            `Reserved stock is inconsistent for campaign ${item.campaignId}.`,
          );
        }
      }

      // 6. Xác định customerId nhận voucher (xử lý quà tặng gửi cho tài khoản hiện có)
      let targetCustomerId = order.customerId;
      if (order.isGift && order.recipientEmail) {
        const recipientUser = await tx.user.findUnique({
          where: { email: order.recipientEmail },
          select: { userId: true },
        });
        if (recipientUser) {
          targetCustomerId = recipientUser.userId;
        }
      }

      // 7. Phát hành mã Voucher Code ngẫu nhiên bảo mật (độ dài 12 ký tự) (RB-05, RB-06)
      for (const item of order.orderItems) {
        const refundDeadlineAt =
          item.refundAllowedSnapshot && item.refundWindowHoursSnapshot
            ? new Date(
                now.getTime() + item.refundWindowHoursSnapshot * 60 * 60 * 1000,
              )
            : null;
        await tx.orderItem.update({
          where: { itemId: item.itemId },
          data: { refundDeadlineAt },
        });

        for (let i = 0; i < item.quantity; i++) {
          // Tạo mã ngẫu nhiên cryptographically secure bằng Node.js crypto
          const uniqueCode = crypto
            .randomBytes(6)
            .toString('hex')
            .toUpperCase(); // 12 ký tự hex

          await tx.voucherCode.create({
            data: {
              itemId: item.itemId,
              uniqueCode,
              customerId: targetCustomerId,
              status: VoucherCodeStatus.AVAILABLE,
              issuedAt: now,
              expiresAt: item.campaign.usageEndTime,
            },
          });
        }
      }

      this.logger.log(
        `Hoàn tất thanh toán đơn hàng ${order.orderCode}. Đã phát hành mã voucher thành công.`,
      );
      return updatedOrder;
    });

    // Kích hoạt tác vụ gửi email ngầm bất đồng bộ sau khi transaction thành công thành công
    this.triggerGiftEmailNotification(resultOrder.orderId).catch((err) => {
      this.logger.error(
        `Lỗi khi xử lý gửi email quà tặng ngầm cho đơn ${resultOrder.orderCode}: ${err.message}`,
      );
    });

    return resultOrder;
  }

  /**
   * Helper xử lý đọc thông tin đơn hàng và gửi email quà tặng (nếu là Gift Order).
   * Thực hiện ngầm ngoài transaction để tránh lock DB quá lâu và không block client callback.
   */
  private async triggerGiftEmailNotification(orderId: string) {
    // 1. Đọc chi tiết thông tin đơn hàng cùng thông tin người mua và voucher codes vừa tạo
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      include: {
        customer: {
          select: { fullName: true },
        },
        orderItems: {
          include: {
            campaign: {
              select: { title: true },
            },
            voucherCodes: {
              select: { uniqueCode: true },
            },
          },
        },
      },
    });

    if (!order) return;

    // 2. Kiểm tra điều kiện quà tặng
    if (order.isGift && order.recipientEmail) {
      const senderName = order.customer.fullName || 'Một người bạn';
      const giftMessage = order.recipientNote; // Sử dụng recipient_note làm lời chúc

      const vouchers: { title: string; code: string }[] = [];
      for (const item of order.orderItems) {
        for (const code of item.voucherCodes) {
          vouchers.push({
            title: item.campaign.title,
            code: code.uniqueCode,
          });
        }
      }

      if (vouchers.length > 0) {
        // Gửi email thực tế
        await this.emailService.sendGiftEmail(
          order.recipientEmail,
          senderName,
          giftMessage,
          order.orderCode,
          vouchers,
        );
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ExpiryProcessor {
  private readonly logger = new Logger(ExpiryProcessor.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Bộ quét định kỳ (mỗi 30 giây) để quét và hủy các đơn hàng giữ chỗ hết hạn thanh toán.
   * Giải phóng số lượng tồn kho đã giữ (decrement reservedStock).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleExpiredReservations() {
    const now = new Date();

    // Bước 1: Tìm tất cả phiếu giữ chỗ ACTIVE đã quá hạn
    const expiredReservations = await this.prisma.inventoryReservation.findMany(
      {
        where: {
          status: ReservationStatus.ACTIVE,
          expiresAt: { lt: now },
        },
        orderBy: { expiresAt: 'asc' },
        take: 100,
      },
    );

    if (expiredReservations.length === 0) {
      return;
    }

    this.logger.log(
      `Tìm thấy ${expiredReservations.length} phiếu giữ chỗ tồn kho hết hạn. Tiến hành giải phóng...`,
    );

    // Bước 2: Duyệt qua từng phiếu giữ chỗ và giải phóng trong transaction
    for (const res of expiredReservations) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Use the same lock order for every worker: order -> reservation -> campaign.
          await tx.$queryRaw`
            SELECT order_id FROM "Orders"
            WHERE order_id = ${res.orderId}::uuid
            FOR UPDATE
          `;
          await tx.$queryRaw`
            SELECT reservation_id FROM "Inventory_Reservations"
            WHERE reservation_id = ${res.reservationId}::uuid
            FOR UPDATE
          `;

          const currentReservation = await tx.inventoryReservation.findUnique({
            where: { reservationId: res.reservationId },
          });

          if (
            !currentReservation ||
            currentReservation.status !== ReservationStatus.ACTIVE ||
            currentReservation.expiresAt >= now
          ) {
            return;
          }

          await tx.$queryRaw`
            SELECT campaign_id FROM "Voucher_Campaigns"
            WHERE campaign_id = ${currentReservation.campaignId}::uuid
            FOR UPDATE
          `;

          const transition = await tx.inventoryReservation.updateMany({
            where: {
              reservationId: currentReservation.reservationId,
              status: ReservationStatus.ACTIVE,
              expiresAt: { lt: now },
            },
            data: { status: ReservationStatus.EXPIRED },
          });

          if (transition.count !== 1) {
            return;
          }

          const released = await tx.voucherCampaign.updateMany({
            where: {
              campaignId: currentReservation.campaignId,
              reservedStock: { gte: currentReservation.quantity },
            },
            data: {
              reservedStock: { decrement: currentReservation.quantity },
            },
          });

          if (released.count !== 1) {
            throw new Error(
              `Reserved stock is inconsistent for campaign ${currentReservation.campaignId}.`,
            );
          }

          const order = await tx.order.findUnique({
            where: { orderId: currentReservation.orderId },
          });

          if (
            order &&
            order.paymentStatus === PaymentStatus.UNPAID &&
            order.orderStatus === OrderStatus.PENDING
          ) {
            await tx.order.update({
              where: { orderId: currentReservation.orderId },
              data: {
                orderStatus: OrderStatus.CANCELLED,
              },
            });
            this.logger.log(
              `Đã hủy đơn hàng quá hạn thanh toán: ${order.orderCode}`,
            );
          }
        });
      } catch (err: unknown) {
        const errorStack = err instanceof Error ? err.stack : String(err);
        this.logger.error(
          `Lỗi khi hủy phiếu giữ chỗ ${res.reservationId} của đơn hàng ${res.orderId}:`,
          errorStack,
        );
      }
    }
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  VoucherStatus,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { ActivityCategory } from '@prisma/client';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import { paginateResult } from '../common/pagination';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Tạo đơn hàng từ giỏ hàng hiện tại của khách hàng.
   * Sử dụng khóa dòng SELECT FOR UPDATE (Concurrency Row Locking) để chống bán lố (Oversold).
   * @param customerId ID khách hàng thực hiện thanh toán
   * @param dto DTO chứa thông tin cổng thanh toán và ghi chú
   * @returns Đơn hàng vừa tạo
   */
  async checkout(customerId: string, dto: CheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize checkout attempts for the same customer. This prevents two
      // concurrent requests from creating orders from the same cart.
      await tx.$queryRaw`
        SELECT user_id FROM "Users"
        WHERE user_id = ${customerId}::uuid
        FOR UPDATE
      `;

      let cartItems = await tx.cartItem.findMany({
        where: { customerId },
        orderBy: { campaignId: 'asc' },
      });

      const selectedIds = dto.cartItemIds;
      if (selectedIds && selectedIds.length > 0) {
        cartItems = cartItems.filter((item) =>
          selectedIds.includes(item.cartItemId),
        );
      }

      if (cartItems.length === 0) {
        throw new BadRequestException(
          'Giỏ hàng của bạn đang trống hoặc không có sản phẩm nào được chọn.',
        );
      }

      let totalAmount = new Prisma.Decimal(0);
      const currentUnitPrices = new Map<string, Prisma.Decimal>();
      const policySnapshots = new Map<
        string,
        {
          refundAllowed: boolean;
          refundWindowHours: number | null;
          refundPolicy: string | null;
          cancellationPolicy: string | null;
          policyVersion: number;
        }
      >();
      const now = new Date();

      // Lock campaigns in a stable order to avoid deadlocks between checkouts.
      for (const item of cartItems) {
        await tx.$queryRaw`
          SELECT campaign_id FROM "Voucher_Campaigns"
          WHERE campaign_id = ${item.campaignId}::uuid
          FOR UPDATE
        `;

        const campaign = await tx.voucherCampaign.findUnique({
          where: { campaignId: item.campaignId },
        });

        if (!campaign) {
          throw new NotFoundException(`Chiến dịch voucher không tồn tại.`);
        }

        if (
          campaign.status !== VoucherStatus.APPROVED ||
          campaign.saleStartTime > now ||
          campaign.saleEndTime <= now
        ) {
          throw new BadRequestException(
            `Voucher "${campaign.title}" hiện không mở bán.`,
          );
        }

        const available =
          campaign.capacity - (campaign.soldQuantity + campaign.reservedStock);
        if (available < item.quantity) {
          throw new BadRequestException(
            `Voucher "${campaign.title}" không đủ số lượng trong kho (Còn lại: ${available}).`,
          );
        }

        if (!campaign.salePrice) {
          throw new BadRequestException(
            `Voucher "${campaign.title}" chưa được thiết lập giá bán. Vui lòng liên hệ quản trị viên.`,
          );
        }

        currentUnitPrices.set(item.campaignId, campaign.salePrice);
        policySnapshots.set(item.campaignId, {
          refundAllowed: campaign.refundAllowed,
          refundWindowHours: campaign.refundWindowHours,
          refundPolicy: campaign.refundPolicy,
          cancellationPolicy: campaign.cancellationPolicy,
          policyVersion: campaign.policyVersion,
        });
        totalAmount = totalAmount.add(campaign.salePrice.mul(item.quantity));
      }

      for (const item of cartItems) {
        await tx.voucherCampaign.update({
          where: { campaignId: item.campaignId },
          data: {
            reservedStock: { increment: item.quantity },
          },
        });
      }

      const orderCode = `ORD-${randomBytes(12).toString('hex').toUpperCase()}`;
      const reservationExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

      const order = await tx.order.create({
        data: {
          orderCode,
          customerId,
          recipientNote: dto.recipientNote,
          isGift: dto.isGift ?? false,
          recipientEmail: dto.recipientEmail,
          totalAmount,
          selectedPaymentProvider: dto.paymentProvider,
          orderStatus: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          reservationExpiresAt,
        },
      });

      for (const item of cartItems) {
        const unitPrice = currentUnitPrices.get(item.campaignId);
        if (!unitPrice) {
          throw new BadRequestException(
            'Không thể xác định giá voucher hiện tại.',
          );
        }
        const policySnapshot = policySnapshots.get(item.campaignId);
        if (!policySnapshot) {
          throw new BadRequestException(
            'Không thể xác định chính sách voucher hiện tại.',
          );
        }

        await tx.orderItem.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaignId,
            quantity: item.quantity,
            unitPrice,
            refundAllowedSnapshot: policySnapshot.refundAllowed,
            refundWindowHoursSnapshot: policySnapshot.refundWindowHours,
            refundPolicySnapshot: policySnapshot.refundPolicy,
            cancellationPolicySnapshot: policySnapshot.cancellationPolicy,
            policyVersionSnapshot: policySnapshot.policyVersion,
          },
        });

        await tx.inventoryReservation.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaignId,
            quantity: item.quantity,
            status: ReservationStatus.ACTIVE,
            expiresAt: reservationExpiresAt,
          },
        });
      }

      await tx.cartItem.deleteMany({
        where: {
          customerId,
          cartItemId: { in: cartItems.map((item) => item.cartItemId) },
        },
      });

      return order;
    });
  }

  /**
   * Xem danh sách lịch sử đơn hàng của một khách hàng cụ thể.
   * @param customerId ID khách hàng
   */
  async getCustomerOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        orderItems: {
          include: {
            campaign: {
              select: { title: true, category: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Xem chi tiết một đơn hàng của khách hàng.
   * @param customerId ID khách hàng sở hữu
   * @param orderId ID đơn hàng cần xem
   */
  async getOrderDetails(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderId, customerId },
      include: {
        orderItems: {
          include: {
            campaign: {
              include: {
                partner: {
                  select: { companyName: true },
                },
              },
            },
          },
        },
        paymentTransactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
    }

    return order;
  }

  /**
   * Yêu cầu hoàn tiền và hủy đơn hàng (Refund logic).
   * Ràng buộc:
   * 1. Kiểm tra State Machine: Chỉ đơn hàng CONFIRMED và PAID mới được phép hoàn tiền.
   * 2. Kiểm tra Policy Snapshot & Deadline: refundAllowedSnapshot và refundWindowHoursSnapshot.
   * 3. Kiểm tra (RB-14): Chỉ hoàn tiền khi toàn bộ mã voucher trong đơn hàng chưa được sử dụng.
   * @param customerId ID khách hàng yêu cầu hoàn tiền
   * @param orderId ID đơn hàng cần hoàn tiền
   */
  async requestRefund(customerId: string, orderId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tìm đơn hàng và khóa dòng để đảm bảo nhất quán
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${orderId}::uuid
        FOR UPDATE
      `;

      const order = await tx.order.findFirst({
        where: { orderId, customerId },
        include: {
          orderItems: true,
          paymentTransactions: {
            where: { status: 'SUCCEEDED' },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(
          'Không tìm thấy đơn hàng yêu cầu hoàn tiền.',
        );
      }

      // Kiểm tra State Machine: Ngăn chặn thao tác trên đơn hàng đã hủy / hoàn tiền
      if (
        order.orderStatus === OrderStatus.CANCELLED ||
        order.paymentStatus === PaymentStatus.REFUNDED
      ) {
        throw new BadRequestException(
          'Đơn hàng này đã được hủy hoặc hoàn tiền trước đó.',
        );
      }

      if (
        order.paymentStatus !== PaymentStatus.PAID ||
        order.orderStatus !== OrderStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Chỉ có thể hoàn tiền cho các đơn hàng đã thanh toán thành công.',
        );
      }

      // 2. Kiểm tra chính sách hoàn tiền snapshot tại thời điểm mua (Policy snapshot & deadline)
      const now = new Date();
      for (const item of order.orderItems) {
        if (item.refundAllowedSnapshot === false) {
          throw new BadRequestException(
            'Voucher trong đơn hàng này không cho phép hoàn tiền theo chính sách lúc mua.',
          );
        }

        if (
          item.refundWindowHoursSnapshot &&
          item.refundWindowHoursSnapshot > 0
        ) {
          const refundDeadline = new Date(
            order.createdAt.getTime() +
              item.refundWindowHoursSnapshot * 3600 * 1000,
          );
          if (now > refundDeadline) {
            throw new BadRequestException(
              `Đã quá thời hạn yêu cầu hoàn tiền (${item.refundWindowHoursSnapshot} giờ kể từ khi đặt hàng).`,
            );
          }
        }
      }

      const payment = order.paymentTransactions[0];
      if (!payment) {
        throw new BadRequestException(
          'Không tìm thấy giao dịch thanh toán thành công liên kết.',
        );
      }

      // 3. Tìm toàn bộ các mã voucher đã phát hành từ đơn hàng này
      const usedVoucherCode = await tx.voucherCode.findFirst({
        where: {
          orderItem: { orderId: order.orderId },
          OR: [{ status: 'USED' }, { usageLogs: { some: {} } }],
        },
        select: { codeId: true },
      });

      // Multi-use vouchers remain AVAILABLE until their final use, therefore
      // usage history is the authoritative signal for refund eligibility.
      if (usedVoucherCode) {
        throw new BadRequestException(
          'Không thể hoàn tiền vì đã có ít nhất một mã voucher trong đơn hàng đã được sử dụng.',
        );
      }

      // 4. Hủy bỏ tất cả các mã voucher chưa dùng (chuyển sang CANCELLED)
      await tx.voucherCode.updateMany({
        where: {
          orderItem: { orderId: order.orderId },
          status: { in: ['AVAILABLE', 'LOCKED', 'EXPIRED'] },
        },
        data: { status: 'CANCELLED' },
      });

      // 5. Khởi tạo bản ghi hoàn tiền PaymentRefund
      await tx.paymentRefund.create({
        data: {
          paymentId: payment.paymentId,
          amountMinor: payment.requestAmountMinor,
          currency: payment.requestCurrency,
          status: 'SUCCEEDED', // Giả lập thành công từ nhà cung cấp
          idempotencyKey: `REFUND-${order.orderId}-${Date.now()}`,
          reason: 'Khách hàng tự hủy và yêu cầu hoàn tiền trực tuyến.',
        },
      });

      // 6. Cập nhật trạng thái đơn hàng thành CANCELLED và trạng thái thanh toán thành REFUNDED
      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      // 7. Hoàn lại số lượng tồn kho của voucher chiến dịch (giảm soldQuantity)
      for (const item of order.orderItems) {
        const restored = await tx.voucherCampaign.updateMany({
          where: {
            campaignId: item.campaignId,
            soldQuantity: { gte: item.quantity },
          },
          data: {
            soldQuantity: { decrement: item.quantity },
          },
        });
        if (restored.count !== 1) {
          throw new Error(
            `Sold quantity is inconsistent for campaign ${item.campaignId}.`,
          );
        }
      }

      await this.auditService.logActivity(
        {
          actorUserId: customerId,
          actorRoleSnapshot: 'CUSTOMER',
          category: ActivityCategory.TRANSACTION,
          actionType: 'REQUEST_REFUND',
          targetEntity: 'Order',
          targetId: orderId,
        },
        tx,
      );

      return updatedOrder;
    });

    return result;
  }

  /**
   * Admin: Xem danh sách toàn bộ đơn hàng trên hệ thống.
   */
  async adminListOrders(query: AdminOrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      orderStatus: query.orderStatus,
      paymentStatus: query.paymentStatus,
      ...(query.keyword
        ? {
            OR: [
              { orderCode: { contains: query.keyword, mode: 'insensitive' } },
              {
                customer: {
                  fullName: {
                    contains: query.keyword,
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  email: { contains: query.keyword, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              fullName: true,
              email: true,
            },
          },
          orderItems: {
            include: {
              campaign: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { orderId: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginateResult(items, total, query.page, query.limit);
  }

  /**
   * Admin: Thực hiện hoàn tiền/hủy đơn hàng trực tuyến của hệ thống.
   * Bỏ qua kiểm tra khách hàng sở hữu.
   * @param adminId ID quản trị viên thực hiện
   * @param orderId ID đơn hàng cần hoàn tiền
   */
  async adminRefundOrder(adminId: string, orderId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Khóa dòng
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${orderId}::uuid
        FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { orderId },
        include: {
          orderItems: true,
          paymentTransactions: {
            where: { status: 'SUCCEEDED' },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng cần hủy.');
      }

      if (
        order.orderStatus === OrderStatus.CANCELLED ||
        order.paymentStatus === PaymentStatus.REFUNDED
      ) {
        throw new BadRequestException(
          'Đơn hàng này đã được hủy hoặc hoàn tiền trước đó.',
        );
      }

      if (
        order.paymentStatus !== PaymentStatus.PAID ||
        order.orderStatus !== OrderStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Chỉ có thể hoàn tiền cho các đơn hàng đã thanh toán thành công.',
        );
      }

      const payment = order.paymentTransactions[0];
      if (!payment) {
        throw new BadRequestException(
          'Không tìm thấy giao dịch thanh toán thành công liên kết.',
        );
      }

      const usedVoucherCode = await tx.voucherCode.findFirst({
        where: {
          orderItem: { orderId: order.orderId },
          OR: [{ status: 'USED' }, { usageLogs: { some: {} } }],
        },
        select: { codeId: true },
      });

      if (usedVoucherCode) {
        throw new BadRequestException(
          'Không thể hoàn tiền vì đã có ít nhất một mã voucher đã được sử dụng.',
        );
      }

      // Hủy mã
      await tx.voucherCode.updateMany({
        where: {
          orderItem: { orderId: order.orderId },
          status: { in: ['AVAILABLE', 'LOCKED', 'EXPIRED'] },
        },
        data: { status: 'CANCELLED' },
      });

      // Tạo refund log
      await tx.paymentRefund.create({
        data: {
          paymentId: payment.paymentId,
          amountMinor: payment.requestAmountMinor,
          currency: payment.requestCurrency,
          status: 'SUCCEEDED',
          idempotencyKey: `ADMIN-REFUND-${order.orderId}-${Date.now()}`,
          reason: 'Quản trị viên hệ thống chủ động hủy và hoàn tiền.',
        },
      });

      // Cập nhật trạng thái
      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      // Trả lại tồn kho
      for (const item of order.orderItems) {
        const restored = await tx.voucherCampaign.updateMany({
          where: {
            campaignId: item.campaignId,
            soldQuantity: { gte: item.quantity },
          },
          data: {
            soldQuantity: { decrement: item.quantity },
          },
        });
        if (restored.count !== 1) {
          throw new Error(
            `Sold quantity is inconsistent for campaign ${item.campaignId}.`,
          );
        }
      }

      await this.auditService.logAction(
        adminId,
        'ADMIN_REFUND_ORDER',
        'Order',
        orderId,
        tx,
      );

      return updatedOrder;
    });

    return result;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { VoucherCodeStatus } from '@prisma/client';

/**
 * Bộ xử lý quét định kỳ (Cron Job) tự động cập nhật các mã VoucherCode hết hạn.
 * Quét các mã VoucherCode có status là AVAILABLE nhưng:
 * 1. expiresAt cá nhân < now, hoặc
 * 2. usageEndTime của chiến dịch liên kết < now.
 * Chuyển trạng thái sang EXPIRED.
 */
@Injectable()
export class VoucherExpiryProcessor {
  private readonly logger = new Logger(VoucherExpiryProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredVoucherCodes() {
    const now = new Date();

    try {
      // 1. Quét mã voucher hết hạn dựa theo hạn cá nhân (expiresAt < now)
      const expiredIndividual = await this.prisma.voucherCode.updateMany({
        where: {
          status: {
            in: [VoucherCodeStatus.AVAILABLE, VoucherCodeStatus.LOCKED],
          },
          expiresAt: { lt: now },
        },
        data: {
          status: VoucherCodeStatus.EXPIRED,
        },
      });

      if (expiredIndividual.count > 0) {
        this.logger.log(
          `[VoucherExpiryProcessor] Đã chuyển EXPIRED cho ${expiredIndividual.count} mã voucher quá hạn cá nhân.`,
        );
      }

      // 2. Quét mã voucher hết hạn dựa theo thời gian sử dụng của chiến dịch (usageEndTime < now)
      const expiredCampaign = await this.prisma.voucherCode.updateMany({
        where: {
          status: {
            in: [VoucherCodeStatus.AVAILABLE, VoucherCodeStatus.LOCKED],
          },
          orderItem: {
            campaign: {
              usageEndTime: { lt: now },
            },
          },
        },
        data: {
          status: VoucherCodeStatus.EXPIRED,
        },
      });

      if (expiredCampaign.count > 0) {
        this.logger.log(
          `[VoucherExpiryProcessor] Đã chuyển EXPIRED cho ${expiredCampaign.count} mã voucher do chiến dịch hết hạn.`,
        );
      }
    } catch (error) {
      this.logger.error(
        '[VoucherExpiryProcessor] Lỗi khi thực hiện quét mã voucher hết hạn:',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

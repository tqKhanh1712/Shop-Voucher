import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo đánh giá/phản hồi mới cho chiến dịch voucher.
   * Ràng buộc: Khách hàng phải đã đặt mua thành công và ĐÃ SỬ DỤNG ít nhất một mã voucher thuộc chiến dịch này.
   * @param customerId ID khách hàng thực hiện đánh giá
   * @param campaignId ID chiến dịch voucher
   * @param rating Số sao đánh giá (1-5)
   * @param comment Nội dung bình luận
   */
  async createReview(
    customerId: string,
    campaignId: string,
    rating: number,
    comment?: string,
  ) {
    // 1. Kiểm tra rating hợp lệ (từ 1 đến 5)
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Điểm đánh giá phải nằm trong khoảng từ 1 đến 5 sao.');
    }

    // 2. Kiểm tra chiến dịch voucher tồn tại
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('Không tìm thấy chiến dịch voucher để đánh giá.');
    }

    // 3. Ràng buộc: Phải có ít nhất 1 voucher của chiến dịch này thuộc về khách hàng ở trạng thái USED
    const hasRedeemed = await this.prisma.voucherCode.findFirst({
      where: {
        customerId,
        status: 'USED',
        orderItem: {
          campaignId,
        },
      },
    });

    if (!hasRedeemed) {
      throw new BadRequestException(
        'Bạn chỉ được phép đánh giá chiến dịch voucher này sau khi đã mua và thực hiện đổi sử dụng mã voucher thành công.',
      );
    }

    // 4. Kiểm tra xem khách hàng đã đánh giá chương trình này chưa để tránh gửi lặp
    const existingReview = await this.prisma.voucherReview.findFirst({
      where: { customerId, campaignId },
    });

    if (existingReview) {
      throw new BadRequestException('Bạn đã gửi đánh giá cho chiến dịch voucher này rồi.');
    }

    // 5. Lưu đánh giá mới vào cơ sở dữ liệu
    try {
      return await this.prisma.voucherReview.create({
        data: {
          customerId,
          campaignId,
          rating,
          comment,
        },
        include: {
          customer: {
            select: {
              fullName: true,
            },
          },
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bạn đã gửi đánh giá cho chiến dịch voucher này rồi.');
      }
      throw error;
    }
  }

  /**
   * Lấy danh sách đánh giá của một chiến dịch voucher cụ thể.
   * @param campaignId ID chiến dịch
   */
  async getCampaignReviews(campaignId: string) {
    const reviews = await this.prisma.voucherReview.findMany({
      where: { campaignId },
      include: {
        customer: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Tính toán thống kê trung bình sao
    const totalCount = reviews.length;
    const averageRating =
      totalCount > 0
        ? Number((reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalCount).toFixed(1))
        : 0;

    return {
      reviews,
      statistics: {
        totalCount,
        averageRating,
      },
    };
  }
}

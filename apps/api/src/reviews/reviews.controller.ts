import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  /**
   * Tạo đánh giá mới (Chỉ dành cho CUSTOMER).
   * POST /reviews
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async createReview(
    @Req() req: any,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(
      req.user.userId,
      dto.campaignId,
      dto.rating,
      dto.comment,
    );
  }

  /**
   * Lấy danh sách đánh giá của một chiến dịch voucher (Truy cập công khai).
   * GET /reviews/campaign/:campaignId
   */
  @Get('campaign/:campaignId')
  async getCampaignReviews(@Param('campaignId') campaignId: string) {
    return this.reviewsService.getCampaignReviews(campaignId);
  }
}

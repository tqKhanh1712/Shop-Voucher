import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import {
  Prisma,
  VoucherStatus,
  PartnerApprovalStatus,
  UserRole,
  ActivityCategory,
  VoucherCodeStatus,
} from '@prisma/client';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';
import { PartnerVoucherCodesQueryDto } from './dto/partner-voucher-codes-query.dto';
import {
  AdminCategoryQueryDto,
  CreateAdminCategoryDto,
  UpdateAdminCategoryDto,
} from './dto/admin-category.dto';
import { AuditService } from '../audit/audit.service';
import { VIETNAM_PROVINCES } from '../common/constants/vietnam-provinces';
import { CampaignListQueryDto } from './dto/campaign-list-query.dto';
import { paginateResult } from '../common/pagination';
import { EmbeddingService } from './search/embedding.service';
import {
  buildCatalogSearchQuery,
  CatalogFacets,
  CatalogSearchQueryRow,
  normalizeCatalogKeyword,
} from './catalog-search';

interface CampaignStatsRow {
  campaignId: string;
  issuedCodeCount: bigint;
  usedCount: bigint;
  cancelledCount: bigint;
  revenue: Prisma.Decimal | null;
}

interface PartnerCampaignSummaryRow {
  totalCampaigns: bigint;
  totalCapacity: bigint;
  soldQuantity: bigint;
  totalRevenue: Prisma.Decimal | null;
}

export type RedemptionEligibilityReason =
  | 'ELIGIBLE'
  | 'NOT_STARTED'
  | 'INDIVIDUAL_EXPIRED'
  | 'CAMPAIGN_EXPIRED'
  | 'USED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'LOCKED'
  | 'UNAVAILABLE';

export interface RedemptionEligibility {
  redeemable: boolean;
  reason: RedemptionEligibilityReason;
  message: string | null;
}

/**
 * Service quản lý toàn bộ nghiệp vụ tạo, cập nhật, chuyển đổi trạng thái (vòng đời) chiến dịch Voucher.
 */
@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private embeddingService: EmbeddingService,
  ) {}

  private mapCatalogPresentation<
    T extends {
      campaignBrands?: Array<{ isPrimary: boolean; brand: unknown }>;
      campaignCategories?: Array<{ isPrimary: boolean; category: unknown }>;
    },
  >(campaign: T) {
    const { campaignBrands = [], campaignCategories = [], ...base } = campaign;
    return {
      ...base,
      primaryBrand:
        campaignBrands.find((relation) => relation.isPrimary)?.brand ??
        campaignBrands[0]?.brand ??
        null,
      brands: campaignBrands.map((relation) => relation.brand),
      primaryCategory:
        campaignCategories.find((relation) => relation.isPrimary)?.category ??
        campaignCategories[0]?.category ??
        null,
      categories: campaignCategories.map((relation) => relation.category),
    };
  }

  private resolveActorPartnerId(actorUser: {
    userId: string;
    role: string;
    partnerId?: string | null;
  }): string | null {
    if (actorUser.role === UserRole.ADMIN) {
      return null;
    }

    if (actorUser.role === UserRole.PARTNER) {
      return actorUser.userId;
    }

    if (actorUser.role === UserRole.PARTNER_STAFF && actorUser.partnerId) {
      return actorUser.partnerId;
    }

    throw new ForbiddenException('Tài khoản không có phạm vi đối tác hợp lệ.');
  }

  private evaluateRedemptionEligibility(
    voucher: { status: VoucherCodeStatus; expiresAt: Date | null },
    campaign: { usageStartTime: Date; usageEndTime: Date },
    now = new Date(),
  ): RedemptionEligibility {
    const unavailableByStatus: Partial<
      Record<VoucherCodeStatus, RedemptionEligibility>
    > = {
      [VoucherCodeStatus.USED]: {
        redeemable: false,
        reason: 'USED',
        message: 'Mã voucher này đã được sử dụng.',
      },
      [VoucherCodeStatus.EXPIRED]: {
        redeemable: false,
        reason: 'EXPIRED',
        message: 'Mã voucher này đã hết hạn.',
      },
      [VoucherCodeStatus.CANCELLED]: {
        redeemable: false,
        reason: 'CANCELLED',
        message: 'Mã voucher này đã bị hủy.',
      },
      [VoucherCodeStatus.LOCKED]: {
        redeemable: false,
        reason: 'LOCKED',
        message: 'Mã voucher này hiện đang bị khóa.',
      },
    };
    const statusEligibility = unavailableByStatus[voucher.status];
    if (statusEligibility) return statusEligibility;

    if (voucher.status !== VoucherCodeStatus.AVAILABLE) {
      return {
        redeemable: false,
        reason: 'UNAVAILABLE',
        message: 'Mã voucher này không ở trạng thái khả dụng.',
      };
    }

    if (voucher.expiresAt && now > voucher.expiresAt) {
      return {
        redeemable: false,
        reason: 'INDIVIDUAL_EXPIRED',
        message: 'Mã voucher cá nhân đã hết hạn sử dụng.',
      };
    }

    if (now < campaign.usageStartTime) {
      return {
        redeemable: false,
        reason: 'NOT_STARTED',
        message: 'Voucher chưa đến thời gian áp dụng.',
      };
    }

    if (now > campaign.usageEndTime) {
      return {
        redeemable: false,
        reason: 'CAMPAIGN_EXPIRED',
        message: 'Voucher đã hết hạn sử dụng theo chiến dịch.',
      };
    }

    return { redeemable: true, reason: 'ELIGIBLE', message: null };
  }

  /**
   * Tạo chiến dịch voucher mới ở trạng thái DRAFT.
   */
  async create(partnerId: string, createCampaignDto: CreateCampaignDto) {
    const {
      title,
      description,
      termsAndConditions,
      thumbnailUrl,
      category,
      originalPrice,
      salePrice,
      saleStartTime,
      saleEndTime,
      usageStartTime,
      usageEndTime,
      capacity,
      isMultiUse,
      maxUsesPerCode,
      branchIds,
    } = createCampaignDto;

    // Bước 1: Xác thực đối tác đã được phê duyệt chưa (BR-PAR-01)
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });
    if (!partner || partner.approvalStatus !== PartnerApprovalStatus.APPROVED) {
      throw new ForbiddenException(
        'Tài khoản đối tác của bạn chưa được xét duyệt kích hoạt bởi Admin.',
      );
    }

    // Bước 2: Thực thi các quy tắc ràng buộc nghiệp vụ (Business Rules)
    // RB-02: Giá bán khuyến mãi phải nhỏ hơn giá gốc
    if (salePrice >= originalPrice) {
      throw new BadRequestException(
        'Giá khuyến mãi phải nhỏ hơn giá gốc của voucher (RB-02).',
      );
    }

    // RB-03: Thời gian mở bán kết thúc phải lớn hơn thời gian mở bán bắt đầu
    const startSale = new Date(saleStartTime);
    const endSale = new Date(saleEndTime);
    if (endSale <= startSale) {
      throw new BadRequestException(
        'Thời gian kết thúc bán phải sau thời gian bắt đầu bán (RB-03).',
      );
    }

    const startUsage = new Date(usageStartTime);
    const endUsage = new Date(usageEndTime);
    if (endUsage <= startUsage) {
      throw new BadRequestException(
        'Thời gian kết thúc sử dụng phải sau thời gian bắt đầu sử dụng.',
      );
    }

    // Bước 3: Kiểm tra quyền sở hữu các chi nhánh được gán (RB-09)
    const ownedBranches = await this.prisma.branch.findMany({
      where: {
        partnerId,
        branchId: { in: branchIds },
      },
    });

    if (ownedBranches.length !== branchIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều chi nhánh được lựa chọn không trực thuộc quyền sở hữu của bạn.',
      );
    }

    // Bước 4: Lưu vào cơ sở dữ liệu thông qua transaction để gán các chi nhánh liên kết
    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo chiến dịch voucher
      const campaign = await tx.voucherCampaign.create({
        data: {
          partnerId,
          title,
          description,
          termsAndConditions,
          thumbnailUrl,
          category,
          originalPrice,
          salePrice,
          saleStartTime: startSale,
          saleEndTime: endSale,
          usageStartTime: startUsage,
          usageEndTime: endUsage,
          capacity,
          isMultiUse: isMultiUse ?? false,
          maxUsesPerCode,
          status: VoucherStatus.DRAFT, // Mặc định tạo mới ở dạng nháp
        },
      });

      // 2. Gán liên kết chi nhánh áp dụng vào bảng junction Campaign_Branches (RB-09)
      const campaignBranchesData = branchIds.map((branchId) => ({
        partnerId,
        campaignId: campaign.campaignId,
        branchId,
      }));

      await tx.campaignBranch.createMany({
        data: campaignBranchesData,
      });

      return tx.voucherCampaign.findUnique({
        where: { campaignId: campaign.campaignId },
        include: {
          campaignBranches: {
            include: { branch: true },
          },
        },
      });
    });
  }

  /**
   * Cập nhật chiến dịch khi ở trạng thái DRAFT hoặc REJECTED.
   */
  async update(
    partnerId: string,
    campaignId: string,
    updateCampaignDto: UpdateCampaignDto,
  ) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign || campaign.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    // Chỉ cho phép chỉnh sửa khi chiến dịch ở trạng thái nháp DRAFT hoặc bị từ chối REJECTED
    if (
      campaign.status !== VoucherStatus.DRAFT &&
      campaign.status !== VoucherStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Chỉ có thể chỉnh sửa chiến dịch voucher đang ở trạng thái Nháp hoặc Từ chối.',
      );
    }

    const { branchIds, ...updateData } = updateCampaignDto;

    // Kiểm tra tính hợp lệ của giá nếu có cập nhật
    const originalPrice =
      updateData.originalPrice ?? Number(campaign.originalPrice);
    const salePrice = updateData.salePrice ?? Number(campaign.salePrice);
    if (salePrice >= originalPrice) {
      throw new BadRequestException(
        'Giá khuyến mãi phải nhỏ hơn giá gốc của voucher (RB-02).',
      );
    }

    // Kiểm tra tính hợp lệ của ngày nếu có cập nhật
    const startSale = updateData.saleStartTime
      ? new Date(updateData.saleStartTime)
      : campaign.saleStartTime;
    const endSale = updateData.saleEndTime
      ? new Date(updateData.saleEndTime)
      : campaign.saleEndTime;
    if (endSale <= startSale) {
      throw new BadRequestException(
        'Thời gian kết thúc bán phải sau thời gian bắt đầu bán (RB-03).',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật các trường dữ liệu cơ bản
      await tx.voucherCampaign.update({
        where: { campaignId },
        data: {
          ...updateData,
          originalPrice,
          salePrice,
          saleStartTime: startSale,
          saleEndTime: endSale,
          usageStartTime: updateData.usageStartTime
            ? new Date(updateData.usageStartTime)
            : campaign.usageStartTime,
          usageEndTime: updateData.usageEndTime
            ? new Date(updateData.usageEndTime)
            : campaign.usageEndTime,
          status: VoucherStatus.DRAFT, // Trả lại trạng thái DRAFT sau khi sửa đổi
        },
      });

      // 2. Cập nhật danh sách chi nhánh liên kết nếu có truyền lên
      if (branchIds) {
        // Xác minh chi nhánh thuộc sở hữu
        const ownedBranches = await tx.branch.findMany({
          where: {
            partnerId,
            branchId: { in: branchIds },
          },
        });
        if (ownedBranches.length !== branchIds.length) {
          throw new BadRequestException(
            'Một hoặc các chi nhánh được gán không trực thuộc quyền sở hữu của bạn.',
          );
        }

        // Xóa liên kết cũ và thêm liên kết mới
        await tx.campaignBranch.deleteMany({
          where: { campaignId },
        });

        await tx.campaignBranch.createMany({
          data: branchIds.map((branchId) => ({
            partnerId,
            campaignId,
            branchId,
          })),
        });
      }

      return tx.voucherCampaign.findUnique({
        where: { campaignId },
        include: {
          campaignBranches: {
            include: { branch: true },
          },
        },
      });
    });
  }

  /**
   * Gửi duyệt chiến dịch, chuyển DRAFT/REJECTED thành PENDING_APPROVAL.
   */
  async submitForApproval(partnerId: string, campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign || campaign.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    if (
      campaign.status !== VoucherStatus.DRAFT &&
      campaign.status !== VoucherStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Chỉ có thể gửi duyệt chiến dịch voucher đang ở trạng thái Nháp hoặc Bị từ chối.',
      );
    }

    return this.prisma.voucherCampaign.update({
      where: { campaignId },
      data: { status: VoucherStatus.PENDING_APPROVAL },
    });
  }

  /**
   * Lấy chiến dịch của một đối tác kèm bộ lọc, phân trang và số liệu tổng hợp.
   */
  async getPartnerCampaigns(
    partnerId: string,
    query = new CampaignListQueryDto(),
  ) {
    const where: Prisma.VoucherCampaignWhereInput = {
      partnerId,
      status: query.status,
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword, mode: 'insensitive' } },
              {
                description: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
              { category: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const statusFilter = query.status
      ? Prisma.sql`AND vc.status::text = ${query.status}`
      : Prisma.empty;
    const keywordFilter = query.keyword
      ? Prisma.sql`AND (
          vc.title ILIKE ${`%${query.keyword}%`}
          OR vc.description ILIKE ${`%${query.keyword}%`}
          OR vc.category ILIKE ${`%${query.keyword}%`}
        )`
      : Prisma.empty;
    const skip = (query.page - 1) * query.limit;
    const [campaigns, [summary]] = await Promise.all([
      this.prisma.voucherCampaign.findMany({
        where,
        include: {
          campaignBranches: {
            include: { branch: true },
          },
          campaignCategories: {
            include: {
              category: {
                select: {
                  nameVi: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { campaignId: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.$queryRaw<PartnerCampaignSummaryRow[]>(Prisma.sql`
        WITH filtered AS (
          SELECT vc.campaign_id, vc.capacity
          FROM "Voucher_Campaigns" vc
          WHERE vc.partner_id = ${partnerId}::uuid
          ${statusFilter}
          ${keywordFilter}
        ),
        code_stats AS (
          SELECT
            oi.campaign_id,
            COUNT(*) FILTER (WHERE code.status::text <> 'CANCELLED') AS sold
          FROM "Voucher_Codes" code
          JOIN "Order_Items" oi ON oi.item_id = code.item_id
          JOIN filtered f ON f.campaign_id = oi.campaign_id
          GROUP BY oi.campaign_id
        ),
        order_stats AS (
          SELECT
            oi.campaign_id,
            SUM(oi.quantity * oi.unit_price) AS revenue
          FROM "Order_Items" oi
          JOIN filtered f ON f.campaign_id = oi.campaign_id
          GROUP BY oi.campaign_id
        )
        SELECT
          COUNT(*) AS "totalCampaigns",
          COALESCE(SUM(f.capacity), 0) AS "totalCapacity",
          COALESCE(SUM(c.sold), 0) AS "soldQuantity",
          COALESCE(SUM(o.revenue), 0) AS "totalRevenue"
        FROM filtered f
        LEFT JOIN code_stats c ON c.campaign_id = f.campaign_id
        LEFT JOIN order_stats o ON o.campaign_id = f.campaign_id
      `),
    ]);

    const campaignIds = campaigns.map((campaign) => campaign.campaignId);
    const stats =
      campaignIds.length === 0
        ? []
        : await this.prisma.$queryRaw<CampaignStatsRow[]>(Prisma.sql`
            WITH code_stats AS (
              SELECT
                oi.campaign_id,
                COUNT(*) AS issued,
                COUNT(*) FILTER (WHERE code.status::text = 'USED') AS used,
                COUNT(*) FILTER (WHERE code.status::text = 'CANCELLED') AS cancelled
              FROM "Voucher_Codes" code
              JOIN "Order_Items" oi ON oi.item_id = code.item_id
              WHERE oi.campaign_id IN (${Prisma.join(campaignIds)})
              GROUP BY oi.campaign_id
            ),
            order_stats AS (
              SELECT
                campaign_id,
                SUM(quantity * unit_price) AS revenue
              FROM "Order_Items"
              WHERE campaign_id IN (${Prisma.join(campaignIds)})
              GROUP BY campaign_id
            )
            SELECT
              ids.campaign_id AS "campaignId",
              COALESCE(c.issued, 0) AS "issuedCodeCount",
              COALESCE(c.used, 0) AS "usedCount",
              COALESCE(c.cancelled, 0) AS "cancelledCount",
              COALESCE(o.revenue, 0) AS revenue
            FROM unnest(ARRAY[${Prisma.join(campaignIds)}]::uuid[]) ids(campaign_id)
            LEFT JOIN code_stats c ON c.campaign_id = ids.campaign_id
            LEFT JOIN order_stats o ON o.campaign_id = ids.campaign_id
          `);
    const statsByCampaign = new Map(
      stats.map((item) => [item.campaignId, item]),
    );
    const items = campaigns.map((campaign) => {
      const campaignStats = statsByCampaign.get(campaign.campaignId);
      const issuedCodeCount = Number(campaignStats?.issuedCodeCount ?? 0);
      const cancelledCount = Number(campaignStats?.cancelledCount ?? 0);

      return {
        ...campaign,
        soldQuantity: issuedCodeCount - cancelledCount,
        issuedCodeCount,
        usedCount: Number(campaignStats?.usedCount ?? 0),
        revenue: Number(campaignStats?.revenue ?? 0),
      };
    });
    const total = Number(summary?.totalCampaigns ?? 0);

    return {
      ...paginateResult(items, total, query.page, query.limit),
      summary: {
        totalCampaigns: total,
        totalCapacity: Number(summary?.totalCapacity ?? 0),
        soldQuantity: Number(summary?.soldQuantity ?? 0),
        totalRevenue: Number(summary?.totalRevenue ?? 0),
      },
    };
  }

  /**
   * Lấy chi tiết chiến dịch kèm thống kê từng trạng thái mã.
   */
  async getPartnerCampaignDetail(partnerId: string, campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findFirst({
      where: { campaignId, partnerId },
      include: {
        campaignBranches: { include: { branch: true } },
        campaignCategories: {
          include: { category: { include: { parent: true } } },
          orderBy: { isPrimary: 'desc' },
        },
        campaignBrands: {
          include: { brand: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(
        'Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    const statusGroups = await this.prisma.voucherCode.groupBy({
      by: ['status'],
      where: { orderItem: { campaignId } },
      _count: { _all: true },
    });
    const codeStats = Object.values(VoucherCodeStatus).reduce(
      (stats, status) => ({ ...stats, [status]: 0 }),
      {} as Record<VoucherCodeStatus, number>,
    );
    for (const group of statusGroups) {
      codeStats[group.status] = group._count._all;
    }

    const issuedCodeCount = statusGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );

    return {
      ...this.mapCatalogPresentation(campaign),
      soldQuantity: issuedCodeCount - codeStats.CANCELLED,
      codeStats,
      issuedCodeCount,
    };
  }

  /**
   * Lấy danh sách phân trang các mã đã phát hành của chiến dịch thuộc đối tác.
   */
  async getPartnerVoucherCodes(
    partnerId: string,
    campaignId: string,
    query: PartnerVoucherCodesQueryDto,
  ) {
    const campaign = await this.prisma.voucherCampaign.findFirst({
      where: { campaignId, partnerId },
      select: { campaignId: true },
    });
    if (!campaign) {
      throw new NotFoundException(
        'Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const keyword = query.keyword?.trim();
    const where: Prisma.VoucherCodeWhereInput = {
      orderItem: { campaignId },
      ...(query.status ? { status: query.status } : {}),
      ...(keyword
        ? {
            OR: [
              { uniqueCode: { contains: keyword, mode: 'insensitive' } },
              {
                orderItem: {
                  order: {
                    orderCode: { contains: keyword, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, codes] = await this.prisma.$transaction([
      this.prisma.voucherCode.count({ where }),
      this.prisma.voucherCode.findMany({
        where,
        select: {
          codeId: true,
          uniqueCode: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
          customer: { select: { fullName: true } },
          orderItem: { select: { order: { select: { orderCode: true } } } },
          _count: { select: { usageLogs: true } },
          usageLogs: {
            select: {
              usageId: true,
              usedAt: true,
              branch: { select: { branchId: true, name: true } },
            },
            orderBy: { usedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: codes.map(({ usageLogs, _count, ...code }) => ({
        ...code,
        usageCount: _count.usageLogs,
        lastUsage: usageLogs[0] ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Đối tác chỉ được ngừng bán APPROVED -> PAUSED hoặc mở lại PAUSED -> APPROVED.
   */
  async updatePartnerCampaignStatus(
    partnerId: string,
    campaignId: string,
    targetStatus: VoucherStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.voucherCampaign.findFirst({
        where: { campaignId, partnerId },
      });
      if (!campaign) {
        throw new NotFoundException(
          'Chiến dịch voucher không tồn tại hoặc bạn không có quyền sở hữu.',
        );
      }

      const isPause =
        campaign.status === VoucherStatus.APPROVED &&
        targetStatus === VoucherStatus.PAUSED;
      const isReactivate =
        campaign.status === VoucherStatus.PAUSED &&
        targetStatus === VoucherStatus.APPROVED;
      if (!isPause && !isReactivate) {
        throw new BadRequestException(
          'Trạng thái chiến dịch đã thay đổi hoặc thao tác không hợp lệ.',
        );
      }

      if (isReactivate) {
        if (campaign.saleEndTime <= new Date()) {
          throw new BadRequestException(
            'Không thể mở bán lại chiến dịch đã hết thời gian bán.',
          );
        }
        if (campaign.soldQuantity >= campaign.capacity) {
          throw new BadRequestException(
            'Không thể mở bán lại chiến dịch đã bán hết số lượng.',
          );
        }
      }

      const transition = await tx.voucherCampaign.updateMany({
        where: { campaignId, partnerId, status: campaign.status },
        data: { status: targetStatus },
      });
      if (transition.count !== 1) {
        throw new BadRequestException(
          'Trạng thái chiến dịch đã thay đổi. Vui lòng thử lại.',
        );
      }

      const updated = await tx.voucherCampaign.findUniqueOrThrow({
        where: { campaignId },
      });
      await this.auditService.logActivity(
        {
          actorUserId: partnerId,
          actorRoleSnapshot: UserRole.PARTNER,
          category: ActivityCategory.VOUCHER,
          actionType: isPause ? 'PAUSE_CAMPAIGN' : 'REACTIVATE_CAMPAIGN',
          targetEntity: 'VoucherCampaign',
          targetId: campaignId,
          metadata: { fromStatus: campaign.status, toStatus: targetStatus },
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Chi tiết chiến dịch voucher.
   */
  async findOne(campaignId: string) {
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
      include: {
        partner: {
          select: { companyName: true, representative: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
        campaignBrands: {
          include: { brand: true },
          orderBy: { isPrimary: 'desc' },
        },
        campaignCategories: {
          include: {
            category: {
              include: { parent: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Không tìm thấy chiến dịch voucher.');
    }

    return this.mapCatalogPresentation(campaign);
  }

  /**
   * Danh mục cấp cao nhất dùng cho bộ lọc catalog. Count chỉ gồm voucher còn hàng,
   * đã được duyệt và đang trong thời gian mở bán.
   */
  async findPublicCategories() {
    const now = new Date();
    const activeCampaignWhere: Prisma.CampaignCategoryWhereInput = {
      campaign: {
        status: VoucherStatus.APPROVED,
        saleStartTime: { lte: now },
        saleEndTime: { gte: now },
      },
    };
    const categories = await this.prisma.voucherCategory.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
      include: {
        campaignCategories: {
          where: activeCampaignWhere,
          select: {
            campaignId: true,
            campaign: {
              select: {
                capacity: true,
                soldQuantity: true,
                reservedStock: true,
              },
            },
          },
        },
        children: {
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
          include: {
            campaignCategories: {
              where: activeCampaignWhere,
              select: {
                campaignId: true,
                campaign: {
                  select: {
                    capacity: true,
                    soldQuantity: true,
                    reservedStock: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const allCampaignIds = new Set<string>();
    const categoryItems = categories.map((category) => {
      const direct = category.campaignCategories.filter(
        (relation) =>
          relation.campaign.soldQuantity + relation.campaign.reservedStock <
          relation.campaign.capacity,
      );
      const children = category.children.map((child) => ({
        code: child.code,
        name: child.nameVi,
        campaignCount: child.campaignCategories.filter(
          (relation) =>
            relation.campaign.soldQuantity + relation.campaign.reservedStock <
            relation.campaign.capacity,
        ).length,
      }));
      const campaignIds = new Set([
        ...direct.map((relation) => relation.campaignId),
        ...category.children.flatMap((child) =>
          child.campaignCategories
            .filter(
              (relation) =>
                relation.campaign.soldQuantity +
                  relation.campaign.reservedStock <
                relation.campaign.capacity,
            )
            .map((relation) => relation.campaignId),
        ),
      ]);
      campaignIds.forEach((campaignId) => allCampaignIds.add(campaignId));

      return {
        code: category.code,
        name: category.nameVi,
        campaignCount: campaignIds.size,
        children,
      };
    });

    return {
      totalCampaignCount: allCampaignIds.size,
      categories: categoryItems,
    };
  }

  /**
   * Khách hàng: Lấy danh sách đối tác đang có voucher khả dụng để làm bộ lọc.
   */
  async findPublicPartners() {
    const now = new Date();
    const partners = await this.prisma.partner.findMany({
      where: {
        user: {
          status: 'ACTIVE',
        },
        campaigns: {
          some: {
            status: VoucherStatus.APPROVED,
            saleStartTime: { lte: now },
            saleEndTime: { gte: now },
          },
        },
      },
      select: {
        partnerId: true,
        companyName: true,
        campaigns: {
          where: {
            status: VoucherStatus.APPROVED,
            saleStartTime: { lte: now },
            saleEndTime: { gte: now },
          },
          select: {
            capacity: true,
            soldQuantity: true,
            reservedStock: true,
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });
    return partners.flatMap(({ campaigns, ...partner }) =>
      campaigns.some(
        (campaign) =>
          campaign.capacity - campaign.soldQuantity - campaign.reservedStock >
          0,
      )
        ? [partner]
        : [],
    );
  }

  /**
   * Khách hàng: Lấy danh sách tỉnh/thành phố có voucher đang mở bán.
   */
  async findPublicProvinces() {
    const now = new Date();
    const relations = await this.prisma.campaignBranch.findMany({
      where: {
        branch: { provinceCode: { not: null } },
        campaign: {
          status: VoucherStatus.APPROVED,
          saleStartTime: { lte: now },
          saleEndTime: { gte: now },
        },
      },
      select: {
        campaignId: true,
        branch: { select: { provinceCode: true } },
        campaign: {
          select: {
            capacity: true,
            soldQuantity: true,
            reservedStock: true,
          },
        },
      },
    });

    const campaignIdsByProvince = new Map<string, Set<string>>();
    for (const relation of relations) {
      const provinceCode = relation.branch.provinceCode;
      if (
        !provinceCode ||
        relation.campaign.soldQuantity + relation.campaign.reservedStock >=
          relation.campaign.capacity
      ) {
        continue;
      }
      const campaignIds =
        campaignIdsByProvince.get(provinceCode) ?? new Set<string>();
      campaignIds.add(relation.campaignId);
      campaignIdsByProvince.set(provinceCode, campaignIds);
    }

    return VIETNAM_PROVINCES.flatMap((province) => {
      const campaignCount = campaignIdsByProvince.get(province.code)?.size ?? 0;
      return campaignCount > 0 ? [{ ...province, campaignCount }] : [];
    });
  }

  /**
   * Lấy danh sách voucher công khai để hiển thị trên trang chủ cho khách hàng.
   * Hỗ trợ tìm kiếm từ khóa, danh mục, khoảng giá và chi nhánh áp dụng.
   */
  async findPublicCatalog(query: PublicCatalogQueryDto) {
    const normalizedKeyword = normalizeCatalogKeyword(query.keyword);
    const normalizedQuery: PublicCatalogQueryDto = {
      ...query,
      keyword: normalizedKeyword || undefined,
    };
    
    const keywordVector = normalizedQuery.keyword 
      ? await this.embeddingService.generateEmbedding(normalizedQuery.keyword, true)
      : null;

    const [result] = await this.prisma.$queryRaw<CatalogSearchQueryRow[]>(
      buildCatalogSearchQuery(normalizedQuery, keywordVector),
    );
    const total = Number(result?.total ?? 0);
    const data = Array.isArray(result?.data) ? result.data : [];
    const facets =
      result?.facets && typeof result.facets === 'object'
        ? (result.facets as unknown as CatalogFacets)
        : { totalCampaignCount: total, categories: [] };

    return {
      data,
      meta: {
        total,
        page: normalizedQuery.page ?? 1,
        limit: normalizedQuery.limit ?? 20,
        totalPages: Math.ceil(total / (normalizedQuery.limit ?? 20)),
      },
      facets,
    };
  }

  // ================= ADMIN OPERATIONS =================

  /**
   * Admin: Xem danh sách các voucher đang chờ phê duyệt.
   */
  async adminListPendingCampaigns() {
    return this.prisma.voucherCampaign.findMany({
      where: { status: VoucherStatus.PENDING_APPROVAL },
      include: {
        partner: {
          select: { companyName: true, representative: true },
        },
        campaignBranches: {
          include: { branch: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Admin: Phê duyệt voucher chiến dịch thành APPROVED.
   */
  async adminApproveCampaign(adminId: string, campaignId: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.voucherCampaign.findUnique({
        where: { campaignId },
      });

      if (!campaign) {
        throw new NotFoundException(
          'Chiến dịch voucher cần duyệt không tồn tại.',
        );
      }

      if (campaign.status !== VoucherStatus.PENDING_APPROVAL) {
        throw new BadRequestException(
          'Chỉ có thể phê duyệt chiến dịch voucher đang ở trạng thái Chờ phê duyệt.',
        );
      }

      const updated = await tx.voucherCampaign.update({
        where: { campaignId },
        data: { status: VoucherStatus.APPROVED },
      });

      await this.auditService.logAction(
        adminId,
        'APPROVE_VOUCHER',
        'VoucherCampaign',
        campaignId,
        tx,
      );
      return updated;
    });
  }

  /**
   * Admin: Từ chối phê duyệt voucher chiến dịch thành REJECTED.
   */
  async adminRejectCampaign(adminId: string, campaignId: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.voucherCampaign.findUnique({
        where: { campaignId },
      });

      if (!campaign) {
        throw new NotFoundException(
          'Chiến dịch voucher cần từ chối không tồn tại.',
        );
      }

      if (campaign.status !== VoucherStatus.PENDING_APPROVAL) {
        throw new BadRequestException(
          'Chỉ có thể từ chối chiến dịch voucher đang ở trạng thái Chờ phê duyệt.',
        );
      }

      const updated = await tx.voucherCampaign.update({
        where: { campaignId },
        data: { status: VoucherStatus.REJECTED },
      });

      await this.auditService.logAction(
        adminId,
        'REJECT_VOUCHER',
        'VoucherCampaign',
        campaignId,
        tx,
      );
      return updated;
    });
  }

  /**
   * Lấy danh sách ví voucher cá nhân của một khách hàng (Customer Wallet).
   * @param customerId ID khách hàng sở hữu các mã voucher
   */
  async getCustomerWallet(customerId: string) {
    return this.prisma.voucherCode.findMany({
      where: {
        customerId,
        OR: [
          {
            orderItem: {
              order: {
                isGift: false,
              },
            },
          },
          {
            orderItem: {
              order: {
                isGift: true,
                customerId: { not: customerId },
              },
            },
          },
        ],
      },
      include: {
        orderItem: {
          include: {
            campaign: {
              include: {
                partner: {
                  select: { companyName: true },
                },
                campaignBranches: {
                  include: { branch: true },
                },
              },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Xem trước thông tin mã voucher trước khi nhân viên xác nhận quét đổi (Preview Verification).
   * @param actorUser Đối tác/Nhân viên quét
   * @param uniqueCode Mã voucher cần kiểm tra
   */
  async verifyVoucherCode(
    actorUser: {
      userId: string;
      role: string;
      partnerId?: string | null;
      branchId?: string | null;
    },
    uniqueCode: string,
  ) {
    const voucher = await this.prisma.voucherCode.findUnique({
      where: { uniqueCode },
      include: {
        customer: {
          select: { fullName: true, email: true },
        },
        orderItem: {
          include: {
            campaign: {
              include: {
                partner: { select: { companyName: true, partnerId: true } },
                campaignBranches: { include: { branch: true } },
              },
            },
          },
        },
        usageLogs: {
          include: { branch: true },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException(
        'Mã voucher này không tồn tại trên hệ thống.',
      );
    }

    const campaign = voucher.orderItem.campaign;
    const actorPartnerId = this.resolveActorPartnerId(actorUser);

    if (actorPartnerId && campaign.partnerId !== actorPartnerId) {
      throw new ForbiddenException('Mã voucher này thuộc về đối tác khác.');
    }

    if (
      actorUser.role === UserRole.PARTNER_STAFF &&
      actorUser.branchId &&
      !campaign.campaignBranches.some(
        (item) => item.branchId === actorUser.branchId,
      )
    ) {
      throw new ForbiddenException(
        'Voucher không áp dụng tại chi nhánh được phân công.',
      );
    }

    // Trả về trạng thái chi tiết của voucher để hiển thị
    const redemptionEligibility = this.evaluateRedemptionEligibility(
      voucher,
      campaign,
    );
    const computedStatus =
      voucher.status === VoucherCodeStatus.AVAILABLE &&
      (redemptionEligibility.reason === 'INDIVIDUAL_EXPIRED' ||
        redemptionEligibility.reason === 'CAMPAIGN_EXPIRED')
        ? VoucherCodeStatus.EXPIRED
        : voucher.status;

    return {
      codeId: voucher.codeId,
      uniqueCode: voucher.uniqueCode,
      status: computedStatus,
      issuedAt: voucher.issuedAt,
      expiresAt: voucher.expiresAt,
      redemptionEligibility,
      customer: voucher.customer,
      campaign: {
        title: campaign.title,
        description: campaign.description,
        usageStartTime: campaign.usageStartTime,
        usageEndTime: campaign.usageEndTime,
        partner: campaign.partner,
        isMultiUse: campaign.isMultiUse,
        maxUsesPerCode: campaign.maxUsesPerCode,
        branches: campaign.campaignBranches.map((cb) => cb.branch.name),
      },
      usageLogs: voucher.usageLogs.map((log) => ({
        usedAt: log.usedAt,
        branchName: log.branch.name,
      })),
    };
  }

  /**
   * Thực hiện quét và đổi mã voucher tại chi nhánh (Redemption logic).
   * Có row-level locking (SELECT FOR UPDATE) để chống race-condition quét trùng lặp.
   * @param actorUser Thông tin đối tác/nhân viên thực hiện quét
   * @param uniqueCode Chuỗi mã voucher cần quét
   * @param branchId ID chi nhánh thực hiện quét
   */
  async redeemVoucher(
    actorUser: {
      userId: string;
      role: string;
      partnerId?: string | null;
      branchId?: string | null;
    },
    uniqueCode: string,
    branchId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tìm VoucherCode theo uniqueCode và khóa dòng để chống double-redemption
      const rawCode = await tx.voucherCode.findUnique({
        where: { uniqueCode },
      });

      if (!rawCode) {
        throw new NotFoundException(
          'Mã voucher này không tồn tại trên hệ thống.',
        );
      }

      await tx.$executeRawUnsafe(
        `SELECT code_id FROM "Voucher_Codes" WHERE code_id = $1::uuid FOR UPDATE`,
        rawCode.codeId,
      );

      // Nạp đầy đủ thông tin liên kết
      const voucher = await tx.voucherCode.findUnique({
        where: { codeId: rawCode.codeId },
        include: {
          orderItem: {
            include: {
              campaign: {
                include: {
                  campaignBranches: true,
                },
              },
            },
          },
          usageLogs: true,
        },
      });

      if (!voucher) {
        throw new NotFoundException('Mã voucher không còn khả dụng.');
      }

      const campaign = voucher.orderItem.campaign;
      const actorPartnerId = this.resolveActorPartnerId(actorUser);

      if (actorPartnerId && campaign.partnerId !== actorPartnerId) {
        throw new ForbiddenException('Mã voucher này thuộc về đối tác khác.');
      }

      if (
        actorUser.role === UserRole.PARTNER_STAFF &&
        actorUser.branchId &&
        actorUser.branchId !== branchId
      ) {
        throw new ForbiddenException(
          'Bạn không được phép quét tại chi nhánh khác.',
        );
      }

      // 3. Kiểm tra chi nhánh áp dụng của chiến dịch voucher (RB-09)
      const isBranchApplicable = campaign.campaignBranches.some(
        (cb) => cb.branchId === branchId,
      );
      if (!isBranchApplicable) {
        throw new BadRequestException(
          'Chiến dịch voucher này không được áp dụng tại chi nhánh hiện tại.',
        );
      }

      // 4-5. Kiểm tra thống nhất trạng thái mã và cửa sổ sử dụng (RB-07, RB-08)
      const now = new Date();
      const redemptionEligibility = this.evaluateRedemptionEligibility(
        voucher,
        campaign,
        now,
      );
      if (
        redemptionEligibility.reason === 'INDIVIDUAL_EXPIRED' ||
        redemptionEligibility.reason === 'CAMPAIGN_EXPIRED'
      ) {
        await tx.voucherCode.update({
          where: { codeId: voucher.codeId },
          data: { status: VoucherCodeStatus.EXPIRED },
        });
      }
      if (!redemptionEligibility.redeemable) {
        throw new BadRequestException(redemptionEligibility.message);
      }

      // 6. Ghi nhận lịch sử sử dụng VoucherUsageLog
      const log = await tx.voucherUsageLog.create({
        data: {
          codeId: voucher.codeId,
          branchId,
          usedAt: now,
        },
        include: {
          branch: true,
        },
      });

      // 7. Xử lý trạng thái mã voucher (Single-use vs Multi-use)
      const totalUses = voucher.usageLogs.length + 1; // Tính cả lượt quét hiện tại
      if (campaign.isMultiUse) {
        const maxUses = campaign.maxUsesPerCode || 1;
        if (totalUses >= maxUses) {
          // Đạt giới hạn quét tối đa -> chuyển sang USED
          await tx.voucherCode.update({
            where: { codeId: voucher.codeId },
            data: { status: 'USED' },
          });
        }
      } else {
        // Single-use -> Chuyển sang USED ngay sau lần quét đầu tiên
        await tx.voucherCode.update({
          where: { codeId: voucher.codeId },
          data: { status: 'USED' },
        });
      }

      await this.auditService.logActivity(
        {
          actorUserId: actorUser.userId,
          actorRoleSnapshot: actorUser.role as UserRole,
          category: ActivityCategory.VOUCHER,
          actionType: 'REDEEM_VOUCHER',
          targetEntity: 'VoucherCode',
          targetId: uniqueCode,
          metadata: { branchId },
        },
        tx,
      );

      return log;
    });

    return result;
  }

  async adminListCategories(query: AdminCategoryQueryDto) {
    const where: Prisma.VoucherCategoryWhereInput = {
      isActive: query.isActive,
      OR: query.keyword
        ? [
            { code: { contains: query.keyword, mode: 'insensitive' } },
            { nameVi: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [categories, total] = await this.prisma.$transaction([
      this.prisma.voucherCategory.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          parent: { select: { nameVi: true } },
          _count: {
            select: { campaignCategories: true },
          },
        },
      }),
      this.prisma.voucherCategory.count({ where }),
    ]);

    return {
      items: categories.map((cat) => ({
        ...cat,
        campaignCount: cat._count.campaignCategories,
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async adminListCategoryOptions() {
    return this.prisma.voucherCategory.findMany({
      where: { isActive: true },
      select: {
        categoryId: true,
        nameVi: true,
        parentId: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { nameVi: 'asc' }],
    });
  }

  /**
   * Admin: Tạo danh mục voucher mới (BR-ADM-05).
   */
  async adminCreateCategory(adminId: string, data: CreateAdminCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.voucherCategory.findUnique({
        where: { code: data.code.trim().toUpperCase() },
      });
      if (existing) {
        throw new BadRequestException(
          'Mã danh mục này đã tồn tại trong hệ thống.',
        );
      }

      if (data.parentId) {
        const parent = await tx.voucherCategory.findUnique({
          where: { categoryId: data.parentId },
        });
        if (!parent)
          throw new BadRequestException('Danh mục cha không tồn tại.');
      }

      const created = await tx.voucherCategory.create({
        data: {
          code: data.code.trim().toUpperCase(),
          nameVi: data.nameVi.trim(),
          parentId: data.parentId || null,
          displayOrder: data.displayOrder ?? 0,
          isActive: true,
        },
      });

      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.CONTENT,
          actionType: 'CREATE_CATEGORY',
          targetEntity: 'VoucherCategory',
          targetId: created.categoryId,
          metadata: { after: created },
        },
        tx,
      );
      return created;
    });
  }

  /**
   * Admin: Cập nhật danh mục voucher (BR-ADM-05).
   */
  async adminUpdateCategory(
    adminId: string,
    categoryId: string,
    data: UpdateAdminCategoryDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.voucherCategory.findUnique({
        where: { categoryId },
      });
      if (!category) {
        throw new NotFoundException('Không tìm thấy danh mục yêu cầu.');
      }

      if (data.parentId === categoryId) {
        throw new BadRequestException(
          'Danh mục không thể là cha của chính nó.',
        );
      }
      if (data.parentId) {
        let cursor: string | null = data.parentId;
        const visited = new Set<string>();
        while (cursor) {
          if (cursor === categoryId || visited.has(cursor)) {
            throw new BadRequestException(
              'Quan hệ danh mục tạo thành vòng lặp không hợp lệ.',
            );
          }
          visited.add(cursor);
          const ancestor: { parentId: string | null } | null =
            await tx.voucherCategory.findUnique({
              where: { categoryId: cursor },
              select: { parentId: true },
            });
          if (!ancestor)
            throw new BadRequestException('Danh mục cha không tồn tại.');
          cursor = ancestor.parentId;
        }
      }

      const updated = await tx.voucherCategory.update({
        where: { categoryId },
        data: {
          nameVi: data.nameVi?.trim(),
          parentId:
            data.parentId !== undefined ? data.parentId || null : undefined,
          displayOrder: data.displayOrder,
          isActive: data.isActive,
        },
      });

      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.CONTENT,
          actionType: 'UPDATE_CATEGORY',
          targetEntity: 'VoucherCategory',
          targetId: categoryId,
          metadata: { before: category, after: updated },
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Admin: Lưu trữ danh mục voucher, không xóa dữ liệu (BR-ADM-05).
   */
  async adminDeleteCategory(adminId: string, categoryId: string) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.voucherCategory.findUnique({
        where: { categoryId },
      });
      if (!category)
        throw new NotFoundException('Không tìm thấy danh mục yêu cầu.');
      const archived = await tx.voucherCategory.update({
        where: { categoryId },
        data: { isActive: false },
      });
      await tx.voucherCategory.updateMany({
        where: { parentId: categoryId },
        data: { isActive: false },
      });

      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.CONTENT,
          actionType: 'ARCHIVE_CATEGORY',
          targetEntity: 'VoucherCategory',
          targetId: categoryId,
          metadata: { before: category, after: archived },
        },
        tx,
      );
      return archived;
    });
  }

  /**
   * Admin: Lấy danh sách toàn bộ chiến dịch voucher (BR-ADM-03).
   * @param query Bộ lọc từ khóa và trạng thái
   */
  async adminListCampaigns(query: CampaignListQueryDto) {
    const where: Prisma.VoucherCampaignWhereInput = {
      status: query.status,
    };
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { description: { contains: query.keyword, mode: 'insensitive' } },
        {
          partner: {
            companyName: { contains: query.keyword, mode: 'insensitive' },
          },
        },
      ];
    }
    const summaryWhere: Prisma.VoucherCampaignWhereInput = {
      OR: where.OR,
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total, statusGroups, totals] = await Promise.all([
      this.prisma.voucherCampaign.findMany({
        where,
        include: {
          partner: {
            select: {
              companyName: true,
              representative: true,
            },
          },
          campaignBranches: {
            include: {
              branch: true,
            },
          },
          campaignCategories: {
            include: {
              category: {
                select: {
                  nameVi: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { campaignId: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.voucherCampaign.count({ where }),
      this.prisma.voucherCampaign.groupBy({
        by: ['status'],
        where: summaryWhere,
        _count: { _all: true },
      }),
      this.prisma.voucherCampaign.aggregate({
        where,
        _sum: { capacity: true, soldQuantity: true },
      }),
    ]);
    const statusCounts = Object.fromEntries(
      Object.values(VoucherStatus).map((status) => [status, 0]),
    ) as Record<VoucherStatus, number>;
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all;
    }

    return {
      ...paginateResult(items, total, query.page, query.limit),
      summary: {
        statusCounts,
        totalCapacity: totals._sum.capacity ?? 0,
        totalSold: totals._sum.soldQuantity ?? 0,
      },
    };
  }

  /**
   * Admin: Cập nhật trạng thái vòng đời của một chiến dịch voucher (BR-ADM-03).
   */
  async adminUpdateCampaignStatus(
    adminId: string,
    campaignId: string,
    status: VoucherStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.voucherCampaign.findUnique({
        where: { campaignId },
      });
      if (!campaign) {
        throw new NotFoundException('Không tìm thấy chiến dịch voucher.');
      }

      const updated = await tx.voucherCampaign.update({
        where: { campaignId },
        data: { status },
      });

      await this.auditService.logAction(
        adminId,
        'UPDATE_CAMPAIGN_STATUS',
        'VoucherCampaign',
        campaignId,
        tx,
      );
      return updated;
    });
  }

  /**
   * Admin/Partner khóa mã (LOCKED) để tạm ngưng khả năng sử dụng.
   * @param actorId ID người thao tác (Admin hoặc Partner)
   * @param codeId ID mã voucher cần khóa
   */
  async lockVoucherCode(
    actorUser: { userId: string; role: string; partnerId?: string | null },
    codeId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucherCode.findUnique({
        where: { codeId },
        include: {
          orderItem: {
            include: {
              campaign: { select: { partnerId: true } },
            },
          },
        },
      });

      if (!voucher) {
        throw new NotFoundException('Không tìm thấy mã voucher yêu cầu.');
      }

      const actorPartnerId = this.resolveActorPartnerId(actorUser);
      if (
        actorPartnerId &&
        voucher.orderItem.campaign.partnerId !== actorPartnerId
      ) {
        throw new ForbiddenException(
          'Bạn không được phép khóa mã voucher của đối tác khác.',
        );
      }

      if (voucher.status !== 'AVAILABLE') {
        throw new BadRequestException(
          `Không thể khóa mã voucher đang ở trạng thái ${voucher.status}.`,
        );
      }

      const transition = await tx.voucherCode.updateMany({
        where: { codeId, status: 'AVAILABLE' },
        data: { status: 'LOCKED' },
      });
      if (transition.count !== 1) {
        throw new BadRequestException(
          'Trạng thái mã voucher đã thay đổi. Vui lòng thử lại.',
        );
      }

      const updated = await tx.voucherCode.findUniqueOrThrow({
        where: { codeId },
      });

      await this.auditService.logActivity(
        {
          actorUserId: actorUser.userId,
          actorRoleSnapshot: actorUser.role as UserRole,
          category: ActivityCategory.VOUCHER,
          actionType: 'LOCK_VOUCHER_CODE',
          targetEntity: 'VoucherCode',
          targetId: codeId,
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Admin/Partner mở khóa mã về trạng thái khả dụng (AVAILABLE).
   * @param actorId ID người thao tác (Admin hoặc Partner)
   * @param codeId ID mã voucher cần mở khóa
   */
  async unlockVoucherCode(
    actorUser: { userId: string; role: string; partnerId?: string | null },
    codeId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucherCode.findUnique({
        where: { codeId },
        include: {
          orderItem: {
            include: {
              campaign: {
                select: { partnerId: true, usageEndTime: true },
              },
            },
          },
        },
      });

      if (!voucher) {
        throw new NotFoundException('Không tìm thấy mã voucher yêu cầu.');
      }

      const actorPartnerId = this.resolveActorPartnerId(actorUser);
      if (
        actorPartnerId &&
        voucher.orderItem.campaign.partnerId !== actorPartnerId
      ) {
        throw new ForbiddenException(
          'Bạn không được phép mở khóa mã voucher của đối tác khác.',
        );
      }

      if (voucher.status !== 'LOCKED') {
        throw new BadRequestException(
          'Chỉ có thể mở khóa đối với các mã voucher đang bị khóa (LOCKED).',
        );
      }

      const now = new Date();
      if (
        (voucher.expiresAt !== null && voucher.expiresAt <= now) ||
        voucher.orderItem.campaign.usageEndTime <= now
      ) {
        await tx.voucherCode.updateMany({
          where: { codeId, status: 'LOCKED' },
          data: { status: 'EXPIRED' },
        });
        await this.auditService.logActivity(
          {
            actorUserId: actorUser.userId,
            actorRoleSnapshot: actorUser.role as UserRole,
            category: ActivityCategory.VOUCHER,
            actionType: 'EXPIRE_VOUCHER_CODE_ON_UNLOCK',
            targetEntity: 'VoucherCode',
            targetId: codeId,
          },
          tx,
        );
        return { expired: true as const, updated: null };
      }

      const transition = await tx.voucherCode.updateMany({
        where: { codeId, status: 'LOCKED' },
        data: { status: 'AVAILABLE' },
      });
      if (transition.count !== 1) {
        throw new BadRequestException(
          'Trạng thái mã voucher đã thay đổi. Vui lòng thử lại.',
        );
      }

      const updated = await tx.voucherCode.findUniqueOrThrow({
        where: { codeId },
      });

      await this.auditService.logActivity(
        {
          actorUserId: actorUser.userId,
          actorRoleSnapshot: actorUser.role as UserRole,
          category: ActivityCategory.VOUCHER,
          actionType: 'UNLOCK_VOUCHER_CODE',
          targetEntity: 'VoucherCode',
          targetId: codeId,
        },
        tx,
      );
      return { expired: false as const, updated };
    });

    if (result.expired) {
      throw new BadRequestException(
        'Mã voucher đã hết hạn và không thể mở khóa.',
      );
    }
    return result.updated;
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import {
  PartnerAccountStatus,
  PartnerApprovalStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import * as bcrypt from 'bcrypt';
import { VIETNAM_PROVINCES } from '../common/constants/vietnam-provinces';
import {
  AdminPartnerListQueryDto,
  PartnerListQueryDto,
  PartnerPerformanceQueryDto,
  PartnerPerformanceSortField,
  SortDirection,
} from './dto/partner-list-query.dto';
import { paginateResult } from '../common/pagination';

interface PartnerDashboardRow {
  partnerName: string;
  totalCampaigns: bigint;
  activeCampaigns: bigint;
  soldVouchers: bigint;
  customerCount: bigint;
  revenue: Prisma.Decimal | null;
  usedVouchers: bigint;
}

interface PartnerPerformanceRow {
  partnerId: string;
  companyName: string;
  totalCampaigns: bigint;
  vouchersSold: bigint;
  revenue: Prisma.Decimal | null;
  usageRate: Prisma.Decimal | null;
  total: bigint;
}

/**
 * Service quản lý logic nghiệp vụ cho Đối tác (Partner) và Chi nhánh (Branch).
 */
@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Lấy danh mục tỉnh/thành dùng khi khai báo chi nhánh.
   * @returns Danh sách mã và tên tỉnh/thành theo mã hành chính hiện hành.
   */
  listProvinces() {
    return VIETNAM_PROVINCES;
  }

  /**
   * Lấy hồ sơ doanh nghiệp kèm thông tin tài khoản của đối tác.
   */
  async getProfile(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy thông tin đối tác.');
    }

    return partner;
  }

  /**
   * Cập nhật hồ sơ và chặn mã số thuế trùng với doanh nghiệp khác.
   */
  async updateProfile(partnerId: string, updatePartnerDto: UpdatePartnerDto) {
    const { companyName, taxCode, representative } = updatePartnerDto;

    // Kiểm tra trùng mã số thuế nếu có cập nhật
    if (taxCode) {
      const existing = await this.prisma.partner.findFirst({
        where: {
          taxCode,
          NOT: { partnerId },
        },
      });
      if (existing) {
        throw new ConflictException(
          'Mã số thuế này đã được đăng ký bởi doanh nghiệp khác.',
        );
      }
    }

    return this.prisma.partner.update({
      where: { partnerId },
      data: {
        companyName,
        taxCode,
        representative,
      },
    });
  }

  /**
   * Tổng hợp chiến dịch, doanh số, khách hàng, doanh thu và số mã đã dùng.
   */
  async getDashboard(partnerId: string) {
    const [dashboard] = await this.prisma.$queryRaw<PartnerDashboardRow[]>`
      SELECT
        p.company_name AS "partnerName",
        COUNT(DISTINCT c.campaign_id) AS "totalCampaigns",
        COUNT(DISTINCT c.campaign_id) FILTER (
          WHERE c.status::text = 'APPROVED'
        ) AS "activeCampaigns",
        COALESCE(DISTINCT_CAMPAIGNS.sold_quantity, 0) AS "soldVouchers",
        COALESCE(SALES.customer_count, 0) AS "customerCount",
        COALESCE(SALES.revenue, 0) AS revenue,
        COALESCE(USED.used_vouchers, 0) AS "usedVouchers"
      FROM "Partners" p
      LEFT JOIN "Voucher_Campaigns" c ON c.partner_id = p.partner_id
      LEFT JOIN LATERAL (
        SELECT SUM(vc.sold_quantity) AS sold_quantity
        FROM "Voucher_Campaigns" vc
        WHERE vc.partner_id = p.partner_id
      ) DISTINCT_CAMPAIGNS ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT o.customer_id) AS customer_count,
          SUM(oi.quantity * oi.unit_price) AS revenue
        FROM "Order_Items" oi
        JOIN "Voucher_Campaigns" vc ON vc.campaign_id = oi.campaign_id
        JOIN "Orders" o ON o.order_id = oi.order_id
        WHERE vc.partner_id = p.partner_id
      ) SALES ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS used_vouchers
        FROM "Voucher_Codes" code
        JOIN "Order_Items" oi ON oi.item_id = code.item_id
        JOIN "Voucher_Campaigns" vc ON vc.campaign_id = oi.campaign_id
        WHERE vc.partner_id = p.partner_id
          AND code.status::text = 'USED'
      ) USED ON TRUE
      WHERE p.partner_id = ${partnerId}::uuid
      GROUP BY
        p.partner_id,
        p.company_name,
        DISTINCT_CAMPAIGNS.sold_quantity,
        SALES.customer_count,
        SALES.revenue,
        USED.used_vouchers
    `;

    if (!dashboard) {
      throw new NotFoundException('Không tìm thấy đối tác để tải dashboard.');
    }

    return {
      partnerName: dashboard.partnerName,
      totalCampaigns: Number(dashboard.totalCampaigns),
      activeCampaigns: Number(dashboard.activeCampaigns),
      soldVouchers: Number(dashboard.soldVouchers),
      customerCount: Number(dashboard.customerCount),
      revenue: Number(dashboard.revenue ?? 0),
      usedVouchers: Number(dashboard.usedVouchers),
    };
  }

  /**
   * Lấy toàn bộ chi nhánh thuộc đối tác để chọn trong form.
   */
  async getBranches(partnerId: string) {
    return this.prisma.branch.findMany({
      where: { partnerId },
      select: {
        branchId: true,
        name: true,
        address: true,
        provinceCode: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Tìm kiếm và phân trang danh sách chi nhánh của chính đối tác.
   * @param partnerId ID đối tác đang đăng nhập.
   * @param query Điều kiện tìm kiếm và phân trang từ màn hình quản lý.
   * @returns Danh sách chi nhánh và metadata phân trang.
   */
  async listBranches(partnerId: string, query: PartnerListQueryDto) {
    const where: Prisma.BranchWhereInput = {
      partnerId,
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { address: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        select: {
          branchId: true,
          name: true,
          address: true,
          provinceCode: true,
        },
        orderBy: [{ name: 'asc' }, { branchId: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.branch.count({ where }),
    ]);

    return paginateResult(items, total, query.page, query.limit);
  }

  /**
   * Tạo chi nhánh mới cho đối tác.
   */
  async createBranch(partnerId: string, createBranchDto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        partnerId,
        name: createBranchDto.name,
        address: createBranchDto.address,
        provinceCode: createBranchDto.provinceCode,
      },
    });
  }

  /**
   * Cập nhật thông tin sau khi xác minh chi nhánh thuộc sở hữu đối tác.
   */
  async updateBranch(
    partnerId: string,
    branchId: string,
    updateBranchDto: UpdateBranchDto,
  ) {
    // Xác minh chi nhánh tồn tại và thuộc sở hữu của đối tác này
    const branch = await this.prisma.branch.findUnique({
      where: { branchId },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    return this.prisma.branch.update({
      where: { branchId },
      data: {
        name: updateBranchDto.name,
        address: updateBranchDto.address,
        provinceCode: updateBranchDto.provinceCode,
      },
    });
  }

  /**
   * Chỉ xóa khi chi nhánh không còn liên kết voucher hoặc nhân viên.
   */
  async deleteBranch(partnerId: string, branchId: string) {
    // Xác minh chi nhánh tồn tại và thuộc sở hữu
    const branch = await this.prisma.branch.findUnique({
      where: { branchId },
      include: {
        campaignBranches: true,
        staff: true,
      },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc bạn không có quyền sở hữu.',
      );
    }

    // RB-09: Chặn xóa nếu chi nhánh đang được liên kết với chiến dịch voucher hoặc có nhân viên
    if (branch.campaignBranches.length > 0) {
      throw new BadRequestException(
        'Không thể xóa chi nhánh đang liên kết với các chương trình voucher.',
      );
    }

    if (branch.staff.length > 0) {
      throw new BadRequestException(
        'Không thể xóa chi nhánh đang có nhân viên quét mã trực thuộc.',
      );
    }

    return this.prisma.branch.delete({
      where: { branchId },
    });
  }

  /**
   * Tạo tài khoản PARTNER_STAFF cho chi nhánh cửa hàng.
   */
  async createStaff(partnerId: string, dto: CreateStaffDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Kiểm tra chi nhánh thuộc sở hữu của đối tác
    const branch = await this.prisma.branch.findUnique({
      where: { branchId: dto.branchId },
    });
    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException(
        'Chi nhánh không tồn tại hoặc không thuộc sở hữu của đối tác.',
      );
    }

    // 2. Kiểm tra trùng lặp theo từng trường để frontend có thể gắn lỗi đúng ô nhập liệu
    const [existingEmail, existingPhone] = await Promise.all([
      this.prisma.user.findFirst({
        where: { email: normalizedEmail },
        select: { userId: true },
      }),
      this.prisma.user.findFirst({
        where: { phone: dto.phone },
        select: { userId: true },
      }),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email đã được đăng ký tài khoản khác.');
    }

    if (existingPhone) {
      throw new ConflictException(
        'Số điện thoại đã được đăng ký tài khoản khác.',
      );
    }

    // 3. Mã hóa mật khẩu
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 4. Tạo user
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: 'PARTNER_STAFF',
        partnerId,
        branchId: dto.branchId,
        status: UserStatus.ACTIVE, // Nhân viên của đối tác mặc định kích hoạt hoạt động
      },
      select: {
        userId: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        branchId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Lấy danh sách nhân viên của đối tác, có tìm kiếm và phân trang.
   */
  async listStaff(partnerId: string, query: PartnerListQueryDto) {
    const where: Prisma.UserWhereInput = {
      partnerId,
      role: 'PARTNER_STAFF',
      ...(query.keyword
        ? {
            OR: [
              { fullName: { contains: query.keyword, mode: 'insensitive' } },
              { email: { contains: query.keyword, mode: 'insensitive' } },
              { phone: { contains: query.keyword, mode: 'insensitive' } },
              {
                branch: {
                  name: { contains: query.keyword, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          userId: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          branchId: true,
          createdAt: true,
          branch: {
            select: { name: true, branchId: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginateResult(items, total, query.page, query.limit);
  }

  /**
   * Cập nhật tên, chi nhánh hoặc mật khẩu của nhân viên thuộc đối tác.
   */
  async updateStaff(
    partnerId: string,
    staffUserId: string,
    dto: UpdateStaffDto,
  ) {
    // 1. Kiểm tra tài khoản nhân viên thuộc đối tác quản lý
    const staff = await this.prisma.user.findFirst({
      where: { userId: staffUserId, partnerId, role: 'PARTNER_STAFF' },
    });
    if (!staff) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản nhân viên cần chỉnh sửa.',
      );
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {};

    if (dto.fullName) {
      updateData.fullName = dto.fullName;
    }

    if (dto.branchId) {
      // Xác thực chi nhánh mới thuộc đối tác sở hữu
      const branch = await this.prisma.branch.findUnique({
        where: { branchId: dto.branchId },
      });
      if (!branch || branch.partnerId !== partnerId) {
        throw new NotFoundException(
          'Chi nhánh không tồn tại hoặc không thuộc sở hữu của đối tác.',
        );
      }
      updateData.branchId = dto.branchId;
    }

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      updateData.passwordChangedAt = new Date();
    }

    const changedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId: staffUserId },
        data: updateData,
        select: {
          userId: true,
          email: true,
          fullName: true,
          role: true,
          branchId: true,
        },
      });
      if (dto.password) {
        await tx.authSession.updateMany({
          where: { userId: staffUserId, revokedAt: null },
          data: { revokedAt: changedAt },
        });
      }
      return updated;
    });
  }

  /**
   * Xóa tài khoản nhân viên của đối tác.
   */
  async deleteStaff(partnerId: string, staffUserId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { userId: staffUserId, partnerId, role: 'PARTNER_STAFF' },
    });
    if (!staff) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản nhân viên cần xóa.',
      );
    }

    return this.prisma.user.delete({
      where: { userId: staffUserId },
      select: { userId: true },
    });
  }

  // ================= ADMIN OPERATIONS =================

  /**
   * Admin: Lấy tổng quan dashboard hệ thống.
   */
  async getAdminDashboard() {
    const [partnerCount, orderSummary, userGroups, campaignGroups] =
      await Promise.all([
        this.prisma.partner.count(),
        this.prisma.order.aggregate({
          _count: true,
          _sum: { totalAmount: true },
          where: { paymentStatus: 'PAID' },
        }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
        this.prisma.voucherCampaign.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      ]);
    const userCounts = Object.fromEntries(
      userGroups.map((group) => [group.role, group._count._all]),
    );
    const campaignCounts = Object.fromEntries(
      campaignGroups.map((group) => [group.status, group._count._all]),
    );
    const campaignCount = campaignGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );

    return {
      totalPartners: partnerCount,
      totalCampaigns: campaignCount,
      totalSuccessfulOrders: orderSummary._count,
      totalRevenue: Number(orderSummary._sum.totalAmount ?? 0),
      userStats: {
        totalCustomers: userCounts.CUSTOMER ?? 0,
        totalPartners: partnerCount,
        totalAdmins: userCounts.ADMIN ?? 0,
        totalStaffs: userCounts.PARTNER_STAFF ?? 0,
      },
      campaignStats: {
        approved: campaignCounts.APPROVED ?? 0,
        pending: campaignCounts.PENDING_APPROVAL ?? 0,
        draft: campaignCounts.DRAFT ?? 0,
        rejected: campaignCounts.REJECTED ?? 0,
        expired: campaignCounts.EXPIRED ?? 0,
        paused: campaignCounts.PAUSED ?? 0,
        soldOut: campaignCounts.SOLD_OUT ?? 0,
      },
    };
  }

  async getAdminPartnerPerformance(query: PartnerPerformanceQueryDto) {
    const sortColumns: Record<PartnerPerformanceSortField, string> = {
      [PartnerPerformanceSortField.COMPANY_NAME]: '"companyName"',
      [PartnerPerformanceSortField.TOTAL_CAMPAIGNS]: '"totalCampaigns"',
      [PartnerPerformanceSortField.VOUCHERS_SOLD]: '"vouchersSold"',
      [PartnerPerformanceSortField.REVENUE]: 'revenue',
      [PartnerPerformanceSortField.USAGE_RATE]: '"usageRate"',
    };
    const sortColumn = Prisma.raw(sortColumns[query.sortField]);
    const sortDirection = Prisma.raw(
      query.sortDirection === SortDirection.ASC ? 'ASC' : 'DESC',
    );
    const keywordFilter = query.keyword
      ? Prisma.sql`WHERE p.company_name ILIKE ${`%${query.keyword}%`}`
      : Prisma.empty;
    const offset = (query.page - 1) * query.limit;

    const rows = await this.prisma.$queryRaw<
      PartnerPerformanceRow[]
    >(Prisma.sql`
      WITH campaign_stats AS (
        SELECT partner_id, COUNT(*) AS total_campaigns
        FROM "Voucher_Campaigns"
        GROUP BY partner_id
      ),
      sales_stats AS (
        SELECT
          vc.partner_id,
          SUM(oi.quantity) AS vouchers_sold,
          SUM(oi.quantity * oi.unit_price) AS revenue
        FROM "Order_Items" oi
        JOIN "Voucher_Campaigns" vc ON vc.campaign_id = oi.campaign_id
        JOIN "Orders" o ON o.order_id = oi.order_id
        WHERE o.payment_status::text = 'PAID'
        GROUP BY vc.partner_id
      ),
      usage_stats AS (
        SELECT vc.partner_id, COUNT(*) AS used_count
        FROM "Voucher_Codes" code
        JOIN "Order_Items" oi ON oi.item_id = code.item_id
        JOIN "Voucher_Campaigns" vc ON vc.campaign_id = oi.campaign_id
        JOIN "Orders" o ON o.order_id = oi.order_id
        WHERE o.payment_status::text = 'PAID'
          AND code.status::text = 'USED'
        GROUP BY vc.partner_id
      )
      SELECT
        p.partner_id AS "partnerId",
        p.company_name AS "companyName",
        COALESCE(c.total_campaigns, 0) AS "totalCampaigns",
        COALESCE(s.vouchers_sold, 0) AS "vouchersSold",
        COALESCE(s.revenue, 0) AS revenue,
        ROUND(
          CASE
            WHEN COALESCE(s.vouchers_sold, 0) = 0 THEN 0
            ELSE COALESCE(u.used_count, 0)::numeric / s.vouchers_sold * 100
          END,
          1
        ) AS "usageRate",
        COUNT(*) OVER() AS total
      FROM "Partners" p
      LEFT JOIN campaign_stats c ON c.partner_id = p.partner_id
      LEFT JOIN sales_stats s ON s.partner_id = p.partner_id
      LEFT JOIN usage_stats u ON u.partner_id = p.partner_id
      ${keywordFilter}
      ORDER BY ${sortColumn} ${sortDirection}, p.partner_id ASC
      LIMIT ${query.limit}
      OFFSET ${offset}
    `);
    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    const items = rows.map((row) => ({
      partnerId: row.partnerId,
      companyName: row.companyName,
      totalCampaigns: Number(row.totalCampaigns),
      vouchersSold: Number(row.vouchersSold),
      revenue: Number(row.revenue ?? 0),
      usageRate: Number(row.usageRate ?? 0),
    }));

    return paginateResult(items, total, query.page, query.limit);
  }

  /**
   * Admin: Lấy danh sách toàn bộ đối tác trên hệ thống kèm thông tin tài khoản để kiểm tra duyệt.
   */
  async adminListPartners(query: AdminPartnerListQueryDto) {
    const where: Prisma.PartnerWhereInput = {
      approvalStatus: query.approvalStatus,
      accountStatus: query.accountStatus,
      ...(query.keyword
        ? {
            OR: [
              { companyName: { contains: query.keyword, mode: 'insensitive' } },
              { taxCode: { contains: query.keyword, mode: 'insensitive' } },
              {
                representative: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  email: { contains: query.keyword, mode: 'insensitive' },
                },
              },
              {
                user: {
                  phone: { contains: query.keyword, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              phone: true,
              fullName: true,
              status: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { partnerId: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return paginateResult(items, total, query.page, query.limit);
  }

  /**
   * Admin: Phê duyệt đối tác (Duyệt hồ sơ & Kích hoạt tài khoản).
   */
  async adminApprovePartner(adminId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác cần duyệt.');
    }

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái phê duyệt của đối tác thành APPROVED
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { approvalStatus: PartnerApprovalStatus.APPROVED },
      });

      // 2. Kích hoạt tài khoản User tương ứng thành ACTIVE (để đăng nhập được)
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: UserStatus.ACTIVE },
      });

      await this.auditService.logAction(
        adminId,
        'APPROVE_PARTNER',
        'Partner',
        partnerId,
        tx,
      );

      return updatedPartner;
    });
    return res;
  }

  /**
   * Admin: Từ chối phê duyệt đối tác.
   */
  async adminRejectPartner(adminId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái thành REJECTED
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { approvalStatus: PartnerApprovalStatus.REJECTED },
      });

      // 2. Khóa tài khoản User tương ứng để chặn đăng nhập
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: UserStatus.LOCKED },
      });
      await tx.authSession.updateMany({
        where: { userId: partnerId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditService.logAction(
        adminId,
        'REJECT_PARTNER',
        'Partner',
        partnerId,
        tx,
      );

      return updatedPartner;
    });
    return res;
  }

  /**
   * Admin: Khóa/Mở khóa tài khoản đối tác.
   */
  async adminTogglePartnerStatus(
    adminId: string,
    partnerId: string,
    status: PartnerAccountStatus,
  ) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    const userStatus =
      status === PartnerAccountStatus.ACTIVE
        ? UserStatus.ACTIVE
        : UserStatus.LOCKED;

    const res = await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái đối tác
      const updatedPartner = await tx.partner.update({
        where: { partnerId },
        data: { accountStatus: status },
      });

      // 2. Đồng bộ khóa/mở khóa User đăng nhập tương ứng
      await tx.user.update({
        where: { userId: partnerId },
        data: { status: userStatus },
      });

      if (userStatus === UserStatus.LOCKED) {
        await tx.authSession.updateMany({
          where: { userId: partnerId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const action =
        status === PartnerAccountStatus.ACTIVE
          ? 'ACTIVATE_PARTNER'
          : 'LOCK_PARTNER';
      await this.auditService.logAction(
        adminId,
        action,
        'Partner',
        partnerId,
        tx,
      );

      return updatedPartner;
    });
    return res;
  }

  /**
   * Admin: Xem chi nhánh của một đối tác bất kỳ.
   */
  async adminGetPartnerBranches(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác.');
    }

    return this.prisma.branch.findMany({
      where: { partnerId },
      orderBy: { name: 'asc' },
    });
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, PartnerAccountStatus } from '@prisma/client';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import {
  AdminPartnerListQueryDto,
  PartnerListQueryDto,
  PartnerPerformanceQueryDto,
} from './dto/partner-list-query.dto';

/**
 * Controller tiếp nhận REST API cho các tác vụ liên quan đến Đối tác và Chi nhánh.
 * Tất cả các endpoints đều yêu cầu xác thực JWT.
 */
@Controller('partners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnersController {
  constructor(private partnersService: PartnersService) {}

  /**
   * Lấy danh mục tỉnh/thành để khai báo khu vực chi nhánh.
   * GET /partners/provinces
   */
  @Get('provinces')
  @Roles(UserRole.PARTNER)
  listProvinces() {
    return this.partnersService.listProvinces();
  }

  /**
   * Lấy thông tin của đối tác hiện tại đang đăng nhập.
   * GET /partners/profile
   */
  @Get('profile')
  @Roles(UserRole.PARTNER)
  async getProfile(@Req() req: any) {
    return this.partnersService.getProfile(req.user.userId);
  }

  /**
   * Cập nhật thông tin doanh nghiệp của chính đối tác đăng nhập.
   * PATCH /partners/profile
   */
  @Patch('profile')
  @Roles(UserRole.PARTNER)
  async updateProfile(
    @Req() req: any,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ) {
    return this.partnersService.updateProfile(
      req.user.userId,
      updatePartnerDto,
    );
  }

  /**
   * Lấy các chỉ số tổng quan cho đối tác hiện tại.
   * GET /partners/dashboard
   */
  @Get('dashboard')
  @Roles(UserRole.PARTNER)
  async getDashboard(@Req() req: any) {
    return this.partnersService.getDashboard(req.user.userId);
  }

  /**
   * Lấy toàn bộ chi nhánh thuộc đối tác hiện tại để chọn trong form.
   * GET /partners/branches
   */
  @Get('branches')
  @Roles(UserRole.PARTNER, UserRole.PARTNER_STAFF)
  async getBranches(@Req() req: any) {
    const partnerId =
      req.user.role === UserRole.PARTNER_STAFF
        ? req.user.partnerId
        : req.user.userId;
    return this.partnersService.getBranches(partnerId);
  }

  /**
   * Lấy danh sách có tìm kiếm và phân trang cho màn hình quản lý.
   * GET /partners/branches/list
   */
  @Get('branches/list')
  @Roles(UserRole.PARTNER)
  async listBranches(@Req() req: any, @Query() query: PartnerListQueryDto) {
    return this.partnersService.listBranches(req.user.userId, query);
  }

  /**
   * Tạo chi nhánh mới thuộc đối tác đăng nhập.
   * POST /partners/branches
   */
  @Post('branches')
  @Roles(UserRole.PARTNER)
  async createBranch(
    @Req() req: any,
    @Body() createBranchDto: CreateBranchDto,
  ) {
    return this.partnersService.createBranch(req.user.userId, createBranchDto);
  }

  /**
   * Cập nhật chi nhánh sau khi service xác nhận quyền sở hữu.
   * PATCH /partners/branches/:id
   */
  @Patch('branches/:id')
  @Roles(UserRole.PARTNER)
  async updateBranch(
    @Req() req: any,
    @Param('id') branchId: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.partnersService.updateBranch(
      req.user.userId,
      branchId,
      updateBranchDto,
    );
  }

  /**
   * Xóa chi nhánh khi không còn ràng buộc nghiệp vụ.
   * DELETE /partners/branches/:id
   */
  @Delete('branches/:id')
  @Roles(UserRole.PARTNER)
  async deleteBranch(@Req() req: any, @Param('id') branchId: string) {
    return this.partnersService.deleteBranch(req.user.userId, branchId);
  }

  /**
   * Tạo tài khoản PARTNER_STAFF cho một chi nhánh.
   * POST /partners/staff
   */
  @Post('staff')
  @Roles(UserRole.PARTNER)
  async createStaff(@Req() req: any, @Body() createStaffDto: CreateStaffDto) {
    return this.partnersService.createStaff(req.user.userId, createStaffDto);
  }

  /**
   * Lấy danh sách nhân viên của đối tác, có tìm kiếm và phân trang.
   * GET /partners/staff
   */
  @Get('staff')
  @Roles(UserRole.PARTNER)
  async listStaff(@Req() req: any, @Query() query: PartnerListQueryDto) {
    return this.partnersService.listStaff(req.user.userId, query);
  }

  /**
   * Cập nhật tài khoản nhân viên thuộc đối tác.
   * PATCH /partners/staff/:id
   */
  @Patch('staff/:id')
  @Roles(UserRole.PARTNER)
  async updateStaff(
    @Req() req: any,
    @Param('id') staffUserId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.partnersService.updateStaff(req.user.userId, staffUserId, dto);
  }

  /**
   * Xóa tài khoản nhân viên thuộc đối tác.
   * DELETE /partners/staff/:id
   */
  @Delete('staff/:id')
  @Roles(UserRole.PARTNER)
  async deleteStaff(@Req() req: any, @Param('id') staffUserId: string) {
    return this.partnersService.deleteStaff(req.user.userId, staffUserId);
  }

  // ================= ADMIN ENDPOINTS =================

  /**
   * Admin: Tổng quan dashboard hệ thống.
   * GET /partners/admin/dashboard
   */
  @Get('admin/dashboard')
  @Roles(UserRole.ADMIN)
  async adminDashboard() {
    return this.partnersService.getAdminDashboard();
  }

  /**
   * Admin: Hiệu suất đối tác phân trang cho bảng dashboard.
   * GET /partners/admin/dashboard/performance
   */
  @Get('admin/dashboard/performance')
  @Roles(UserRole.ADMIN)
  async adminDashboardPerformance(@Query() query: PartnerPerformanceQueryDto) {
    return this.partnersService.getAdminPartnerPerformance(query);
  }

  /**
   * Admin: Xem danh sách đối tác chờ duyệt hoặc đã duyệt.
   * GET /partners/admin/list
   */
  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async adminListPartners(@Query() query: AdminPartnerListQueryDto) {
    return this.partnersService.adminListPartners(query);
  }

  /**
   * Admin: Phê duyệt đối tác.
   * PATCH /partners/admin/:id/approve
   */
  @Patch('admin/:id/approve')
  @Roles(UserRole.ADMIN)
  async adminApprovePartner(@Req() req: any, @Param('id') partnerId: string) {
    return this.partnersService.adminApprovePartner(req.user.userId, partnerId);
  }

  /**
   * Admin: Từ chối phê duyệt đối tác.
   * PATCH /partners/admin/:id/reject
   */
  @Patch('admin/:id/reject')
  @Roles(UserRole.ADMIN)
  async adminRejectPartner(@Req() req: any, @Param('id') partnerId: string) {
    return this.partnersService.adminRejectPartner(req.user.userId, partnerId);
  }

  /**
   * Admin: Khóa hoặc kích hoạt hoạt động tài khoản đối tác.
   * PATCH /partners/admin/:id/toggle-status
   */
  @Patch('admin/:id/toggle-status')
  @Roles(UserRole.ADMIN)
  async adminTogglePartnerStatus(
    @Req() req: any,
    @Param('id') partnerId: string,
    @Body('status') status: PartnerAccountStatus,
  ) {
    return this.partnersService.adminTogglePartnerStatus(
      req.user.userId,
      partnerId,
      status,
    );
  }

  /**
   * Admin: Xem danh sách chi nhánh của một đối tác.
   * GET /partners/admin/:id/branches
   */
  @Get('admin/:id/branches')
  @Roles(UserRole.ADMIN)
  async adminGetPartnerBranches(@Param('id') partnerId: string) {
    return this.partnersService.adminGetPartnerBranches(partnerId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ReplyComplaintDto } from './dto/reply-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { ComplaintMessageDto } from './dto/complaint-message.dto';
import { AdminManageComplaintDto } from './dto/admin-manage-complaint.dto';
import { CustomerComplaintActionDto } from './dto/customer-complaint-action.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

type AuthRequest = Request & {
  user: { userId: string; role: UserRole; partnerId?: string | null };
};
const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@Req() req: AuthRequest, @Body() dto: CreateComplaintDto) {
    return this.complaintsService.create(req.user.userId, dto);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  findMyComplaints(@Req() req: AuthRequest, @Query() query: ComplaintQueryDto) {
    return this.complaintsService.findCustomerComplaints(
      req.user.userId,
      query,
    );
  }

  @Post(':id/messages')
  @Roles(UserRole.CUSTOMER)
  customerMessage(
    @Req() req: AuthRequest,
    @Param('id', uuid) id: string,
    @Body() dto: ComplaintMessageDto,
  ) {
    return this.complaintsService.customerReply(req.user.userId, id, dto);
  }

  @Patch(':id/close')
  @Roles(UserRole.CUSTOMER)
  customerClose(
    @Req() req: AuthRequest,
    @Param('id', uuid) id: string,
    @Body() dto: CustomerComplaintActionDto,
  ) {
    return this.complaintsService.customerTransition(
      req.user.userId,
      id,
      'CLOSED',
      dto.expectedVersion,
    );
  }

  @Patch(':id/reopen')
  @Roles(UserRole.CUSTOMER)
  customerReopen(
    @Req() req: AuthRequest,
    @Param('id', uuid) id: string,
    @Body() dto: CustomerComplaintActionDto,
  ) {
    return this.complaintsService.customerTransition(
      req.user.userId,
      id,
      'IN_REVIEW',
      dto.expectedVersion,
    );
  }

  /**
   * Lấy danh sách vụ việc đối tác cần xử lý, hỗ trợ lọc trạng thái và quá hạn.
   * GET /complaints/partner/list
   */
  @Get('partner/list')
  @Roles(UserRole.PARTNER)
  findPartnerComplaints(
    @Req() req: AuthRequest,
    @Query() query: ComplaintQueryDto,
  ) {
    return this.complaintsService.findPartnerComplaints(req.user.userId, query);
  }

  /**
   * Chỉ trả về chi tiết vụ việc thuộc đúng đối tác đăng nhập.
   * GET /complaints/partner/:id
   */
  @Get('partner/:id')
  @Roles(UserRole.PARTNER)
  findPartnerDetail(@Req() req: AuthRequest, @Param('id', uuid) id: string) {
    return this.complaintsService.findPartnerComplaintDetail(
      req.user.userId,
      id,
    );
  }

  /**
   * Ghi phản hồi của đối tác và chuyển vụ việc về trạng thái đang xem xét.
   * POST /complaints/partner/:id/messages
   */
  @Post('partner/:id/messages')
  @Roles(UserRole.PARTNER)
  partnerMessage(
    @Req() req: AuthRequest,
    @Param('id', uuid) id: string,
    @Body() dto: ComplaintMessageDto,
  ) {
    return this.complaintsService.partnerReply(req.user.userId, id, dto);
  }

  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  findAllAdmin(@Query() query: ComplaintQueryDto) {
    return this.complaintsService.findAllAdmin(query);
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  findOneAdmin(@Param('id', uuid) id: string) {
    return this.complaintsService.findOneAdmin(id);
  }

  @Patch('admin/:id/manage')
  @Roles(UserRole.ADMIN)
  manageComplaint(
    @Param('id', uuid) id: string,
    @Req() req: AuthRequest,
    @Body() dto: AdminManageComplaintDto,
  ) {
    return this.complaintsService.adminManageComplaint(
      id,
      req.user.userId,
      dto,
    );
  }

  // Route tương thích với giao diện cũ; workflow mới dùng /manage.
  @Patch('admin/:id/reply')
  @Roles(UserRole.ADMIN)
  replyComplaint(
    @Param('id', uuid) id: string,
    @Req() req: AuthRequest,
    @Body() dto: ReplyComplaintDto,
  ) {
    return this.complaintsService.replyComplaint(id, req.user.userId, dto);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  findMyComplaintDetail(
    @Req() req: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.complaintsService.findCustomerComplaintDetail(
      req.user.userId,
      id,
    );
  }
}

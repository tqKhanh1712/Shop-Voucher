import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private auditService: AuditService) {}

  /**
   * Lấy lịch sử tất cả các hoạt động quản trị của Admin trên hệ thống.
   * GET /admin/audit-logs
   */
  @Get()
  async getLogs(@Query() query: AuditLogQueryDto) {
    return this.auditService.getAdminLogs(query);
  }

  @Get(':activityId')
  async getLogDetail(
    @Param('activityId', new ParseUUIDPipe({ version: '4' }))
    activityId: string,
  ) {
    return this.auditService.getAdminLogDetail(activityId);
  }
}

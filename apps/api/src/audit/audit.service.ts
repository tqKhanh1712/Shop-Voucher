import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityCategory, Prisma, UserRole } from '@prisma/client';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

const SENSITIVE_METADATA_KEYS =
  /password|token|secret|authorization|cookie|card|cvv/i;

function redactMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetadata);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_METADATA_KEYS.test(key)
          ? '[REDACTED]'
          : redactMetadata(nested),
      ]),
    );
  }
  return value;
}

/**
 * Service ghi nhận nhật ký kiểm toán (Audit Logs) cho quản trị viên và nhật ký hoạt động (Activity Logs) cho toàn hệ thống.
 * Đảm bảo không nuốt lỗi kiểm toán để đáp ứng yêu cầu NFR-06.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ghi nhận lịch sử hoạt động quản trị của Admin.
   * Ném ngoại lệ khi gặp lỗi để đảm bảo tính toàn vẹn nhật ký kiểm toán.
   * @param adminId ID quản trị viên thực hiện hành động
   * @param actionType Loại hành động (vd: 'APPROVE_VOUCHER', 'REJECT_VOUCHER', 'UPDATE_USER_ROLE')
   * @param targetEntity Tên thực thể bị tác động (vd: 'VoucherCampaign', 'User')
   * @param targetId ID của thực thể bị tác động
   */
  async logAction(
    adminId: string,
    actionType: string,
    targetEntity: string,
    targetId: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const admin = await db.user.findUnique({
      where: { userId: adminId },
    });

    if (!admin) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản admin với ID: ${adminId}`,
      );
    }

    const log = await db.activityLog.create({
      data: {
        actorUserId: adminId,
        actorRoleSnapshot: UserRole.ADMIN,
        actorNameSnapshot: admin.fullName || 'Unknown Admin',
        actorEmailSnapshot: admin.email,
        category: ActivityCategory.ADMIN,
        actionType,
        targetEntity,
        targetId,
      },
    });

    this.logger.log(
      `[ActivityLog] Admin ${admin.fullName} (${admin.email}) thực hiện: ${actionType} trên ${targetEntity} (${targetId})`,
    );
    return log;
  }

  /**
   * Ghi nhận lịch sử hoạt động tổng thể của người dùng/hệ thống (ActivityLog).
   * @param data Thông tin hoạt động cần ghi nhận
   */
  async logActivity(
    data: {
      actorUserId?: string | null;
      actorRoleSnapshot?: UserRole | null;
      category: ActivityCategory;
      actionType: string;
      targetEntity: string;
      targetId?: string | null;
      metadata?: Prisma.InputJsonValue;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const actor = data.actorUserId
      ? await db.user.findUnique({
          where: { userId: data.actorUserId },
          select: { fullName: true, email: true, role: true },
        })
      : null;
    const log = await db.activityLog.create({
      data: {
        actorUserId: data.actorUserId || null,
        actorRoleSnapshot: data.actorRoleSnapshot || actor?.role || null,
        actorNameSnapshot: actor?.fullName || null,
        actorEmailSnapshot: actor?.email || null,
        category: data.category,
        actionType: data.actionType,
        targetEntity: data.targetEntity,
        targetId: data.targetId || null,
        metadata: data.metadata
          ? (redactMetadata(data.metadata) as Prisma.InputJsonValue)
          : undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });

    this.logger.log(
      `[ActivityLog] [${data.category}] ${data.actionType} trên ${data.targetEntity} (${data.targetId})`,
    );
    return log;
  }

  /**
   * Lấy danh sách nhật ký kiểm toán (Audit Logs) cho trang quản trị Admin.
   */
  async getAdminLogs(query: AuditLogQueryDto) {
    const where: Prisma.ActivityLogWhereInput = {
      actorUserId: query.actorUserId,
      actorRoleSnapshot: query.actorRole,
      category: query.category,
      actionType: query.actionType
        ? { contains: query.actionType, mode: 'insensitive' }
        : undefined,
      targetEntity: query.targetEntity
        ? { contains: query.targetEntity, mode: 'insensitive' }
        : undefined,
      targetId: query.targetId
        ? { contains: query.targetId, mode: 'insensitive' }
        : undefined,
      occurredAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        select: {
          activityId: true,
          actorUserId: true,
          actorRoleSnapshot: true,
          actorNameSnapshot: true,
          actorEmailSnapshot: true,
          category: true,
          actionType: true,
          targetEntity: true,
          targetId: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: query.sort },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getAdminLogDetail(activityId: string) {
    const log = await this.prisma.activityLog.findUnique({
      where: { activityId },
    });
    if (!log) throw new NotFoundException('Không tìm thấy nhật ký hệ thống.');
    return log;
  }
}

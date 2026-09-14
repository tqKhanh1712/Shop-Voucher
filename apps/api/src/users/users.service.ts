import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';

import { AuditService } from '../audit/audit.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { paginateResult } from '../common/pagination';

/**
 * Service quản lý người dùng (Users), bao gồm các thao tác tìm kiếm,
 * khởi tạo và cập nhật trạng thái hoạt động của tài khoản.
 */
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Tìm kiếm người dùng bằng email duy nhất.
   * @param email Địa chỉ email cần tra cứu
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email?.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Tìm kiếm người dùng bằng số điện thoại duy nhất.
   * @param phone Số điện thoại cần tra cứu
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * Tìm kiếm người dùng bằng mã định danh (user_id).
   * @param userId ID duy nhất của người dùng
   * @returns Bản ghi User hoặc null nếu không tìm thấy
   */
  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { userId },
    });
  }

  /**
   * Tạo tài khoản người dùng mới (đáp ứng điều kiện kiểm tra dữ liệu đầu vào DTO).
   * @param data Đối tượng chứa thông tin khởi tạo tài khoản
   * @returns Bản ghi User vừa được khởi tạo thành công
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Cập nhật trạng thái hoạt động (ACTIVE/LOCKED) của người dùng.
   * Thường được gọi bởi các API quản trị hệ thống (Admin).
   * @param adminId ID quản trị viên thực hiện (nếu có)
   * @param userId ID người dùng cần cập nhật
   * @param status Trạng thái mới cần áp dụng
   * @returns Bản ghi User sau khi cập nhật
   */
  async updateStatus(
    adminId: string | null,
    userId: string,
    status: UserStatus,
  ): Promise<User> {
    const changedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId },
        data: { status },
      });
      if (status !== UserStatus.ACTIVE) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: changedAt },
        });
      }
      if (adminId) {
        await this.auditService.logAction(
          adminId,
          status === UserStatus.LOCKED ? 'LOCK_USER' : 'UNLOCK_USER',
          'User',
          userId,
          tx,
        );
      }
      return updated;
    });
  }

  /**
   * Cập nhật thông tin cá nhân của người dùng.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    const updateData: Prisma.UserUpdateInput = {};

    // 1. Chỉ đổi tên nếu là CUSTOMER
    if (dto.fullName) {
      if (user.role !== 'CUSTOMER') {
        throw new BadRequestException(
          'Chỉ tài khoản khách hàng mới được đổi họ tên.',
        );
      }
      updateData.fullName = dto.fullName;
    }

    // 2. Đổi sđt (cho phép đổi cho tất cả)
    if (dto.phone !== undefined) {
      if (dto.phone) {
        const existingPhone = await this.prisma.user.findFirst({
          where: { phone: dto.phone, NOT: { userId } },
        });
        if (existingPhone) {
          throw new BadRequestException(
            'Số điện thoại này đã được đăng ký cho tài khoản khác.',
          );
        }
      }
      updateData.phone = dto.phone || null;
    }

    // 3. Đổi mật khẩu
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.',
        );
      }
      const isMatch = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isMatch) {
        throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
      }
      updateData.passwordHash = await bcrypt.hash(dto.newPassword, 10);
      updateData.passwordChangedAt = new Date();
    }

    const changedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId },
        data: updateData,
        select: {
          userId: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
      if (dto.newPassword) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: changedAt },
        });
      }
      return updated;
    });
  }

  /**
   * Xóa vĩnh viễn tài khoản người dùng (chỉ áp dụng cho CUSTOMER).
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user || user.role !== 'CUSTOMER') {
      throw new BadRequestException(
        'Chỉ tài khoản Khách hàng mới được tự xóa tài khoản.',
      );
    }

    return this.prisma.user.delete({
      where: { userId },
      select: { userId: true },
    });
  }

  /**
   * Lấy danh sách tất cả các tài khoản người dùng trong hệ thống (chỉ ADMIN).
   * @param query Bộ lọc tìm kiếm và trạng thái
   */
  async adminListUsers(query: AdminUserQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
    };

    if (query.keyword) {
      where.OR = [
        { fullName: { contains: query.keyword, mode: 'insensitive' } },
        { email: { contains: query.keyword, mode: 'insensitive' } },
        { phone: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const summaryWhere: Prisma.UserWhereInput = { OR: where.OR };
    const [items, total, roleGroups, statusGroups] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          userId: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: summaryWhere,
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where: summaryWhere,
        _count: { _all: true },
      }),
    ]);

    const roleCounts = Object.fromEntries(
      Object.values(UserRole).map((role) => [role, 0]),
    ) as Record<UserRole, number>;
    for (const group of roleGroups) roleCounts[group.role] = group._count._all;
    const statusCounts = Object.fromEntries(
      Object.values(UserStatus).map((status) => [status, 0]),
    ) as Record<UserStatus, number>;
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all;
    }

    return {
      ...paginateResult(items, total, query.page, query.limit),
      summary: { roleCounts, statusCounts },
    };
  }

  /**
   * Thay đổi vai trò người dùng (chỉ ADMIN).
   * Đảm bảo tính nhất quán dữ liệu, thu hồi tất cả phiên đăng nhập hiện tại và ghi audit log.
   * @param adminId ID quản trị viên thực hiện
   * @param userId ID người dùng cần đổi vai trò
   * @param role Vai trò mới cần gán
   */
  async adminUpdateRole(adminId: string, userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    const changedAt = new Date();
    const isPartnerRole =
      role === UserRole.PARTNER || role === UserRole.PARTNER_STAFF;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { userId },
        data: {
          role,
          partnerId: isPartnerRole ? user.partnerId : null,
          branchId: isPartnerRole ? user.branchId : null,
        },
        select: {
          userId: true,
          email: true,
          role: true,
          status: true,
        },
      });

      // Thu hồi tất cả phiên đăng nhập active của người dùng để buộc re-authenticate với vai trò mới
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: changedAt },
      });

      await this.auditService.logAction(
        adminId,
        'UPDATE_USER_ROLE',
        'User',
        userId,
        tx,
      );

      return updated;
    });

    return updatedUser;
  }
}

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard thực thi phân quyền dựa trên vai trò của người dùng (RBAC).
 * Đọc metadata vai trò yêu cầu từ decorator @Roles() và so khớp với role của User đã login.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Bước 1: Đọc danh sách vai trò được cấu hình tại handler hoặc class
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // Nếu không cấu hình @Roles() tức là route này không hạn chế vai trò truy cập
    if (!requiredRoles) {
      return true;
    }

    // Bước 2: Lấy thông tin user đã được JwtAuthGuard gán vào request trước đó
    const { user } = context.switchToHttp().getRequest();
    
    // Bước 3: So khớp vai trò của user với danh sách quyền yêu cầu
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Bạn không có quyền truy cập vào tài nguyên này.');
    }

    return true;
  }
}

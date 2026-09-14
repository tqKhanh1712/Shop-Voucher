import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator thiết lập danh sách các quyền (UserRole) được phép truy cập vào endpoint.
 * Sử dụng kèm với RolesGuard.
 * @param roles Mảng chứa các vai trò có quyền truy cập
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

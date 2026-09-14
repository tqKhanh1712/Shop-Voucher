import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  function contextFor(role?: UserRole): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows a user whose database-backed role is required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });

  it('denies a user whose role is not required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(contextFor(UserRole.CUSTOMER))).toThrow(
      ForbiddenException,
    );
  });
});

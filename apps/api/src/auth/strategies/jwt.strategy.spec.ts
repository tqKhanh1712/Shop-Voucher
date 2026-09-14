import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters';
  });

  it('delegates JWT validation to the database-backed session service', async () => {
    const principal = {
      userId: 'user-1',
      sessionId: 'session-1',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      partnerId: null,
      branchId: null,
      idleExpiresAt: new Date(),
      absoluteExpiresAt: new Date(),
    };
    const authSessions = {
      validateAccess: jest.fn().mockResolvedValue(principal),
    };
    const strategy = new JwtStrategy(authSessions as any);
    const payload = {
      sub: principal.userId,
      sid: principal.sessionId,
      purpose: 'access',
      iat: 1,
    };

    await expect(strategy.validate(payload)).resolves.toBe(principal);
    expect(authSessions.validateAccess).toHaveBeenCalledWith(payload);
  });

  it('propagates session expiry and revocation failures', async () => {
    const authSessions = {
      validateAccess: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('Phiên đã hết hạn.')),
    };
    const strategy = new JwtStrategy(authSessions as any);

    await expect(
      strategy.validate({ sub: 'user-1', purpose: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

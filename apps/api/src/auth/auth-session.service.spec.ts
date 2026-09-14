import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const user = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    phone: null,
    passwordHash: 'hash',
    fullName: 'Customer',
    role: UserRole.CUSTOMER,
    partnerId: null,
    branchId: null,
    status: UserStatus.ACTIVE,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    passwordChangedAt: null,
    createdAt: new Date('2026-08-25T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-25T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  function createService({
    prisma = {},
    verify,
  }: {
    prisma?: object;
    verify?: jest.Mock;
  } = {}) {
    let signed = 0;
    const jwt = {
      sign: jest.fn((payload: { purpose: string }) => {
        signed += 1;
        return `${payload.purpose}-token-${signed}`;
      }),
      verify: verify ?? jest.fn(),
    };
    return {
      service: new AuthSessionService(prisma as any, jwt as any),
      jwt,
    };
  }

  it('creates a 60-minute idle window and a fixed 2-hour session', async () => {
    const tx = {
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const { service, jwt } = createService({ prisma });

    const issued = await service.createForUser(user as any, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(issued.session.idleExpiresAt).toEqual(
      new Date('2026-08-25T11:00:00.000Z'),
    );
    expect(issued.session.absoluteExpiresAt).toEqual(
      new Date('2026-08-25T12:00:00.000Z'),
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ purpose: 'access' }),
      { expiresIn: 900 },
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ purpose: 'refresh' }),
      { expiresIn: 7200 },
    );
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: user.userId, revokedAt: null },
      data: { revokedAt: new Date('2026-08-25T10:00:00.000Z') },
    });
    expect(tx.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.userId,
        idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
        absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
      }),
    });
  });

  it('refreshes the idle window without extending the absolute deadline', async () => {
    jest.setSystemTime(new Date('2026-08-25T10:59:00.000Z'));
    const oldToken = 'old-refresh-token';
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          refreshTokenHash: tokenHash(oldToken),
          revokedAt: null,
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const verify = jest.fn().mockReturnValue({
      sub: user.userId,
      sid: sessionId,
      purpose: 'refresh',
    });
    const { service, jwt } = createService({ prisma, verify });

    const refreshed = await service.refresh(oldToken);

    expect(refreshed.session.idleExpiresAt).toEqual(
      new Date('2026-08-25T11:59:00.000Z'),
    );
    expect(refreshed.session.absoluteExpiresAt).toEqual(
      new Date('2026-08-25T12:00:00.000Z'),
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ purpose: 'refresh' }),
      { expiresIn: 3660 },
    );
  });

  it('rejects refresh exactly at the 60-minute idle boundary', async () => {
    jest.setSystemTime(new Date('2026-08-25T11:00:00.000Z'));
    const oldToken = 'old-refresh-token';
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          refreshTokenHash: tokenHash(oldToken),
          revokedAt: null,
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user,
        }),
      },
    };
    const { service } = createService({
      prisma,
      verify: jest.fn().mockReturnValue({
        sub: user.userId,
        sid: sessionId,
        purpose: 'refresh',
      }),
    });

    await expect(service.refresh(oldToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    ['one second before the idle deadline', '2026-08-25T10:59:59.000Z'],
    ['one second before the absolute deadline', '2026-08-25T11:59:59.000Z'],
  ])('accepts access %s', async (_label, currentTime) => {
    jest.setSystemTime(new Date(currentTime));
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          revokedAt: null,
          lastActivityAt: new Date('2026-08-25T09:00:00.000Z'),
          idleExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService({ prisma });

    await expect(
      service.validateAccess({
        sub: user.userId,
        sid: sessionId,
        purpose: 'access',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toEqual(expect.objectContaining({ sessionId }));
  });

  it('rejects access exactly at the fixed 2-hour boundary', async () => {
    jest.setSystemTime(new Date('2026-08-25T12:00:00.000Z'));
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          revokedAt: null,
          idleExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user,
        }),
      },
    };
    const { service } = createService({ prisma });

    await expect(
      service.validateAccess({
        sub: user.userId,
        sid: sessionId,
        purpose: 'access',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('uses the current database role and touches a valid session', async () => {
    const currentUser = { ...user, role: UserRole.ADMIN };
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          revokedAt: null,
          lastActivityAt: new Date('2026-08-25T09:00:00.000Z'),
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user: currentUser,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service } = createService({ prisma });

    await expect(
      service.validateAccess({
        sub: user.userId,
        sid: sessionId,
        purpose: 'access',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toEqual(
      expect.objectContaining({ role: UserRole.ADMIN, sessionId }),
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
        }),
      }),
    );
  });

  it('does not write the session heartbeat again within one minute', async () => {
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          revokedAt: null,
          lastActivityAt: new Date('2026-08-25T09:59:30.000Z'),
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user,
        }),
        updateMany: jest.fn(),
      },
    };
    const { service } = createService({ prisma });

    await expect(
      service.validateAccess({
        sub: user.userId,
        sid: sessionId,
        purpose: 'access',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toEqual(expect.objectContaining({ sessionId }));
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a refresh token replay when atomic rotation loses the race', async () => {
    const oldToken = 'old-refresh-token';
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          sessionId,
          userId: user.userId,
          refreshTokenHash: tokenHash(oldToken),
          revokedAt: null,
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
          user,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const { service } = createService({
      prisma,
      verify: jest.fn().mockReturnValue({
        sub: user.userId,
        sid: sessionId,
        purpose: 'refresh',
      }),
    });

    await expect(service.refresh(oldToken)).rejects.toThrow(
      'Refresh token đã được sử dụng hoặc thu hồi.',
    );
  });

  it('revokes the matching session even when the refresh JWT has expired', async () => {
    const refreshToken = 'expired-refresh-token';
    const prisma = {
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const verify = jest.fn().mockReturnValue({
      sub: user.userId,
      sid: sessionId,
      purpose: 'refresh',
    });
    const { service } = createService({ prisma, verify });

    await service.revokeByRefreshToken(refreshToken);

    expect(verify).toHaveBeenCalledWith(refreshToken, {
      ignoreExpiration: true,
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId,
        userId: user.userId,
        refreshTokenHash: tokenHash(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

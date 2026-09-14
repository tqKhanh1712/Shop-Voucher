import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { createHash } from 'crypto';

describe('AuthService', () => {
  const mockUser = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    phone: null,
    passwordHash: 'old-hash',
    fullName: 'Customer Test',
    role: UserRole.CUSTOMER,
    partnerId: null,
    branchId: null,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    passwordChangedAt: null,
  };

  function createService({
    users = {},
    jwt = {},
    prisma = {},
    sessions = {},
    delivery,
  }: {
    users?: object;
    jwt?: object;
    prisma?: object;
    sessions?: object;
    delivery?: object;
  } = {}) {
    return new AuthService(
      users as any,
      jwt as any,
      prisma as any,
      sessions as any,
      delivery as any,
    );
  }

  it('delivers a reset link without returning the token', async () => {
    const users = { findByEmail: jest.fn().mockResolvedValue(mockUser) };
    const jwt = { sign: jest.fn().mockReturnValue('generated-token') };
    const prisma = { user: { update: jest.fn() } };
    const delivery = { deliver: jest.fn() };
    const service = createService({ users, jwt, prisma, delivery });

    const result = await service.requestPasswordReset({
      email: 'Customer@Example.com ',
    });

    expect(users.findByEmail).toHaveBeenCalledWith('customer@example.com');
    expect(result).not.toHaveProperty('resetToken');
    expect(delivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        resetUrl: expect.stringContaining('generated-token'),
      }),
    );
  });

  it('returns the same generic reset response for an unknown account', async () => {
    const delivery = { deliver: jest.fn() };
    const service = createService({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
      delivery,
    });

    await expect(
      service.requestPasswordReset({ email: 'missing@example.com' }),
    ).resolves.toEqual({
      message:
        'Nếu tài khoản tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu qua email.',
    });
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired reset token', async () => {
    const service = createService({
      jwt: {
        verify: jest.fn().mockImplementation(() => {
          throw new Error();
        }),
      },
    });

    await expect(
      service.resetPassword({
        token: 'invalid-token',
        newPassword: 'newPassword123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an elevated public registration role', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = createService({ prisma });

    await expect(
      service.register({
        email: 'attacker@example.com',
        password: 'Password123!',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects login for an account that is not active', async () => {
    const service = createService({
      users: {
        findByEmail: jest.fn().mockResolvedValue({
          ...mockUser,
          status: UserStatus.PENDING_VERIFICATION,
        }),
      },
    });

    await expect(
      service.login({ email: mockUser.email, password: 'Password123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('delegates refresh rotation to the server-side session service', async () => {
    const sessions = {
      refresh: jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        session: {
          idleExpiresAt: new Date('2026-08-25T11:00:00.000Z'),
          absoluteExpiresAt: new Date('2026-08-25T12:00:00.000Z'),
        },
      }),
    };
    const service = createService({ sessions });

    await expect(service.refresh('old-refresh-token')).resolves.toEqual(
      expect.objectContaining({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: expect.objectContaining({ userId: mockUser.userId }),
      }),
    );
    expect(sessions.refresh).toHaveBeenCalledWith('old-refresh-token');
  });

  it('rejects a reset token that has already been consumed', async () => {
    const tx = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      authSession: { updateMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = createService({
      jwt: {
        verify: jest.fn().mockReturnValue({
          sub: mockUser.userId,
          purpose: 'password-reset',
        }),
      },
      prisma,
    });

    await expect(
      service.resetPassword({
        token: 'used-token',
        newPassword: 'NewPassword123!',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('revokes every active session after a successful password reset', async () => {
    const tx = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = createService({
      jwt: {
        verify: jest.fn().mockReturnValue({
          sub: mockUser.userId,
          purpose: 'password-reset',
        }),
      },
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    });

    await expect(
      service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123!',
      }),
    ).resolves.toEqual({ message: 'Mật khẩu đã được cập nhật thành công.' });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: mockUser.userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('does not allow account verification to unlock a locked account', async () => {
    const updateMany = jest.fn();
    const service = createService({
      users: {
        findByEmail: jest.fn().mockResolvedValue({
          ...mockUser,
          status: UserStatus.LOCKED,
        }),
      },
      prisma: { user: { updateMany } },
    });

    await expect(
      service.verifyAccount({
        email: mockUser.email,
        code: '123456',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('consumes a valid per-account verification code only once', async () => {
    const pendingUser = {
      ...mockUser,
      status: UserStatus.PENDING_VERIFICATION,
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = createService({
      users: { findByEmail: jest.fn().mockResolvedValue(pendingUser) },
      prisma: { user: { updateMany } },
    });
    const code = '654321';
    const expectedHash = createHash('sha256')
      .update(`${pendingUser.userId}:${code}`)
      .digest('hex');

    await expect(
      service.verifyAccount({ email: pendingUser.email, code }),
    ).resolves.toEqual({
      message: 'Xác thực tài khoản thành công! Bạn hiện có thể đăng nhập.',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: pendingUser.userId,
        status: UserStatus.PENDING_VERIFICATION,
        accountVerificationCodeHash: expectedHash,
        accountVerificationExpiresAt: { gt: expect.any(Date) },
      }),
      data: {
        status: UserStatus.ACTIVE,
        accountVerificationCodeHash: null,
        accountVerificationExpiresAt: null,
      },
    });
  });

  it('issues an expiring verification code without returning it', async () => {
    const pendingUser = {
      ...mockUser,
      status: UserStatus.PENDING_VERIFICATION,
    };
    const delivery = { deliver: jest.fn() };
    const userUpdate = jest.fn().mockResolvedValue(pendingUser);
    const service = new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(pendingUser) } as any,
      {} as any,
      { user: { update: userUpdate } } as any,
      {} as any,
      undefined,
      delivery as any,
    );

    const response = await service.requestAccountVerification({
      email: pendingUser.email,
    });

    expect(response).not.toHaveProperty('code');
    expect(userUpdate).toHaveBeenCalledWith({
      where: { userId: pendingUser.userId },
      data: {
        accountVerificationCodeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        accountVerificationExpiresAt: expect.any(Date),
      },
    });
    expect(delivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: pendingUser.email,
        code: expect.stringMatching(/^\d{6}$/),
        expiresAt: expect.any(Date),
      }),
    );
  });
});

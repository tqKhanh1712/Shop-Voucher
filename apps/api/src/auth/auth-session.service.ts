import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AuthRequestContext,
  AuthSessionMetadata,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './auth-session.constants';

interface TokenPayload {
  sub?: string;
  sid?: string;
  purpose?: string;
  iat?: number;
}

export interface AccessPrincipal {
  userId: string;
  sessionId: string;
  role: User['role'];
  partnerId: string | null;
  branchId: string | null;
  status: User['status'];
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface IssuedAuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  session: AuthSessionMetadata;
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createForUser(
    user: User,
    context: AuthRequestContext = {},
  ): Promise<IssuedAuthSession> {
    const now = new Date();
    const sessionId = randomUUID();
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
    const idleExpiresAt = this.nextIdleExpiry(now, absoluteExpiresAt);
    const tokens = this.issueTokens(user, sessionId, absoluteExpiresAt, now);

    await this.prisma.$transaction(async (tx) => {
      // Preserve the current one-active-session-per-user behavior.
      await tx.authSession.updateMany({
        where: { userId: user.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.authSession.create({
        data: {
          sessionId,
          userId: user.userId,
          refreshTokenHash: this.hashToken(tokens.refreshToken),
          userAgent: context.userAgent?.slice(0, 512),
          ipAddress: context.ipAddress?.slice(0, 64),
          createdAt: now,
          lastActivityAt: now,
          idleExpiresAt,
          absoluteExpiresAt,
        },
      });
    });

    return {
      user,
      ...tokens,
      session: { idleExpiresAt, absoluteExpiresAt },
    };
  }

  async refresh(refreshToken: string): Promise<IssuedAuthSession> {
    const payload = this.verifyRefreshToken(refreshToken);
    const now = new Date();
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { sessionId: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.refreshTokenHash !== tokenHash ||
      session.revokedAt ||
      session.idleExpiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ.');
    }

    const idleExpiresAt = this.nextIdleExpiry(now, session.absoluteExpiresAt);
    const tokens = this.issueTokens(
      session.user,
      session.sessionId,
      session.absoluteExpiresAt,
      now,
    );
    const rotated = await this.prisma.authSession.updateMany({
      where: {
        sessionId: session.sessionId,
        userId: session.userId,
        refreshTokenHash: tokenHash,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
        user: { status: UserStatus.ACTIVE },
      },
      data: {
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        lastActivityAt: now,
        idleExpiresAt,
      },
    });

    if (rotated.count !== 1) {
      throw new UnauthorizedException(
        'Refresh token đã được sử dụng hoặc thu hồi.',
      );
    }

    return {
      user: session.user,
      ...tokens,
      session: {
        idleExpiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
      },
    };
  }

  async validateAccess(payload: TokenPayload): Promise<AccessPrincipal> {
    if (payload.purpose !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Token truy cập không hợp lệ.');
    }

    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { sessionId: payload.sid },
      select: {
        sessionId: true,
        userId: true,
        lastActivityAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        revokedAt: true,
        user: {
          select: {
            userId: true,
            role: true,
            partnerId: true,
            branchId: true,
            status: true,
            passwordChangedAt: true,
          },
        },
      },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.idleExpiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực.');
    }

    const passwordChangedAtSeconds = session.user.passwordChangedAt
      ? Math.floor(session.user.passwordChangedAt.getTime() / 1000)
      : null;
    if (
      passwordChangedAtSeconds !== null &&
      (typeof payload.iat !== 'number' ||
        payload.iat < passwordChangedAtSeconds)
    ) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hiệu lực sau khi đổi mật khẩu.',
      );
    }

    let idleExpiresAt = session.idleExpiresAt;
    if (
      now.getTime() - session.lastActivityAt.getTime() >=
      SESSION_TOUCH_INTERVAL_MS
    ) {
      idleExpiresAt = this.nextIdleExpiry(now, session.absoluteExpiresAt);
      const touched = await this.prisma.authSession.updateMany({
        where: {
          sessionId: session.sessionId,
          userId: session.userId,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        data: { lastActivityAt: now, idleExpiresAt },
      });
      if (touched.count !== 1) {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực.');
      }
    }

    return {
      userId: session.user.userId,
      sessionId: session.sessionId,
      role: session.user.role,
      partnerId: session.user.partnerId,
      branchId: session.user.branchId,
      status: session.user.status,
      idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    };
  }

  async revokeByRefreshToken(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        ignoreExpiration: true,
      });
    } catch {
      return;
    }
    if (!payload.sub || !payload.sid || payload.purpose !== 'refresh') {
      return;
    }

    await this.prisma.authSession.updateMany({
      where: {
        sessionId: payload.sid,
        userId: payload.sub,
        refreshTokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(
    userId: string,
    revokedAt = new Date(),
  ): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }

  private verifyRefreshToken(
    refreshToken: string,
  ): Required<Pick<TokenPayload, 'sub' | 'sid' | 'purpose'>> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn.',
      );
    }
    if (!payload.sub || !payload.sid || payload.purpose !== 'refresh') {
      throw new UnauthorizedException(
        'Token không đúng mục đích làm mới phiên.',
      );
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      purpose: payload.purpose,
    };
  }

  private issueTokens(
    user: User,
    sessionId: string,
    absoluteExpiresAt: Date,
    now: Date,
  ) {
    const remainingSeconds = Math.floor(
      (absoluteExpiresAt.getTime() - now.getTime()) / 1000,
    );
    if (remainingSeconds <= 0) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn tối đa.');
    }

    const accessToken = this.jwtService.sign(
      {
        sub: user.userId,
        sid: sessionId,
        role: user.role,
        purpose: 'access',
      },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    const refreshToken = this.jwtService.sign(
      {
        sub: user.userId,
        sid: sessionId,
        jti: randomUUID(),
        purpose: 'refresh',
      },
      { expiresIn: remainingSeconds },
    );
    return { accessToken, refreshToken };
  }

  private nextIdleExpiry(now: Date, absoluteExpiresAt: Date): Date {
    return new Date(
      Math.min(
        now.getTime() + SESSION_IDLE_TTL_MS,
        absoluteExpiresAt.getTime(),
      ),
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

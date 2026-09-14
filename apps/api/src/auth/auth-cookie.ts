import { ForbiddenException } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from './auth-session.constants';

type CookieSameSite = 'lax' | 'strict' | 'none';

function isProduction(): boolean {
  return (process.env.APP_ENV ?? process.env.NODE_ENV) === 'production';
}

function getSameSite(): CookieSameSite {
  const configured = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (
    configured === 'lax' ||
    configured === 'strict' ||
    configured === 'none'
  ) {
    return configured;
  }
  return isProduction() ? 'none' : 'lax';
}

function getCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction() || process.env.AUTH_COOKIE_SECURE === 'true',
    sameSite: getSameSite(),
    path: '/auth',
  };
}

export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  absoluteExpiresAt: Date,
): void {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getCookieOptions(),
    expires: absoluteExpiresAt,
  });
}

export function clearRefreshTokenCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions());
}

export function getRefreshToken(request: Request): string | undefined {
  return request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
}

export function assertTrustedBrowserOrigin(request: Request): void {
  const origin = request.headers.origin;
  if (!origin) {
    return;
  }

  const allowedOrigin = (
    process.env.FRONTEND_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '');
  if (origin.replace(/\/$/, '') !== allowedOrigin) {
    throw new ForbiddenException('Nguồn yêu cầu xác thực không được phép.');
  }
}

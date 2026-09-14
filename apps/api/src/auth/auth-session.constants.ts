export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const SESSION_IDLE_TTL_MS = 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 2 * 60 * 60 * 1000;
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
export const REFRESH_COOKIE_NAME = 'voucher_refresh';

export interface AuthRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthSessionMetadata {
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

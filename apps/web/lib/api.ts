const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface AuthUser {
  userId: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: "CUSTOMER" | "PARTNER" | "PARTNER_STAFF" | "ADMIN";
  partnerId: string | null;
  branchId: string | null;
  status: string;
}

export interface AuthSessionMetadata {
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  session: AuthSessionMetadata;
}

interface ApiErrorResponse {
  message?: string | string[];
}

interface AuthCallbacks {
  onSessionUpdated?: (session: AuthResponse) => void;
  onSessionEnded?: () => void;
}

const AUTH_ENDPOINTS_WITHOUT_RETRY = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
]);

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse> | null = null;
let authCallbacks: AuthCallbacks = {};

export function configureAuthCallbacks(callbacks: AuthCallbacks): () => void {
  authCallbacks = callbacks;
  return () => {
    if (authCallbacks === callbacks) {
      authCallbacks = {};
    }
  };
}

export function acceptAuthSession(session: AuthResponse): void {
  accessToken = session.accessToken;
  authCallbacks.onSessionUpdated?.(session);
}

export function clearClientSession(): void {
  accessToken = null;
  authCallbacks.onSessionEnded?.();
}

async function readApiError(response: Response): Promise<string> {
  const errorData = (await response
    .json()
    .catch(() => ({}))) as ApiErrorResponse;
  if (Array.isArray(errorData.message)) {
    return errorData.message.join(", ");
  }
  return errorData.message || `Lỗi từ hệ thống (Mã: ${response.status})`;
}

export async function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const session = (await response.json()) as AuthResponse;
        acceptAuthSession(session);
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    accessToken = null;
  }
}

/**
 * Fetch wrapper giữ access token trong memory và chỉ cho phép một refresh request
 * chạy tại một thời điểm. Refresh token được trình duyệt gửi bằng cookie HttpOnly.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const request = () =>
    fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });

  let response = await request();
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !AUTH_ENDPOINTS_WITHOUT_RETRY.has(endpoint)
  ) {
    try {
      const refreshed = await refreshSession();
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      response = await request();
    } catch {
      clearClientSession();
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearClientSession();
    }
    throw new Error(await readApiError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

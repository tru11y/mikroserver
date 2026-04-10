import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import {
  isJwtExpiredOrExpiringSoon,
  shouldBypassSessionAuth,
} from './auth-session';

// ---------------------------------------------------------------------------
// Token storage — access token in sessionStorage (XSS-resistant vs cookies).
// Refresh token is httpOnly cookie set server-side via /api/auth/* routes.
// ---------------------------------------------------------------------------

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('access_token');
}

function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('access_token', token);
}

function removeStoredAccessToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('access_token');
}

export const API_URL =
  typeof window !== 'undefined'
    ? window.location.origin + '/proxy'
    : (process.env['API_INTERNAL_URL'] ??
      process.env['NEXT_PUBLIC_API_URL'] ??
      'http://localhost:3000');

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const API_TIMEOUT_MS = 15000;
export const ROUTER_HEAVY_TIMEOUT_MS = 45000;
const ACCESS_TOKEN_REFRESH_GRACE_SECONDS = 30;

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  const path = window.location.pathname;
  if (
    path.startsWith('/login') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')
  ) {
    return;
  }

  window.location.href = '/login';
}

function clearSessionTokens(shouldRedirect = true) {
  removeStoredAccessToken();
  // Tell the server-side route to clear the httpOnly refresh_token cookie.
  // Fire-and-forget — we don't await to avoid blocking the redirect.
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

  if (shouldRedirect) {
    redirectToLogin();
  }
}

/** Called after a successful login/refresh to persist the access token. */
export function persistAccessToken(accessToken: string): void {
  setStoredAccessToken(accessToken);
}

/** Remove the access token from sessionStorage (call on logout). */
export function clearAccessToken(): void {
  removeStoredAccessToken();
}

async function requestTokenRefresh(): Promise<string | null> {
  try {
    // No body needed — the httpOnly refresh_token cookie is sent automatically.
    const response = await axios.post<{
      data: { accessToken: string; refreshToken: string };
    }>('/api/auth/refresh');
    const { accessToken } = response.data.data;

    setStoredAccessToken(accessToken);
    return accessToken;
  } catch {
    clearSessionTokens();
    return null;
  }
}

async function ensureAccessToken(forceRefresh = false): Promise<string | null> {
  const accessToken = getStoredAccessToken();

  if (
    !forceRefresh &&
    accessToken &&
    !isJwtExpiredOrExpiringSoon(
      accessToken,
      Date.now(),
      ACCESS_TOKEN_REFRESH_GRACE_SECONDS,
    )
  ) {
    return accessToken;
  }

  // Refresh via server route — httpOnly cookie is forwarded automatically.
  if (!refreshPromise) {
    isRefreshing = true;
    refreshPromise = requestTokenRefresh().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

/**
 * Unwrap the nested API envelope: AxiosResponse<ApiResponse<T>> → T
 * Replaces the repetitive `(data as any)?.data?.data` pattern.
 */
export function unwrap<T>(response: unknown): T {
  return (response as { data: { data: T } }).data.data;
}

/**
 * Extract error message from an Axios error response.
 * Replaces `(error as any)?.response?.data?.message`.
 */
export function apiError(error: unknown, fallback = 'Une erreur est survenue'): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  );
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (shouldBypassSessionAuth(config.url)) {
      return config;
    }

    const token = await ensureAccessToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !shouldBypassSessionAuth(originalRequest?.url)
    ) {
      if (isRefreshing) {
        return (refreshPromise ?? Promise.resolve<string | null>(null)).then((token) => {
          if (!token) {
            return Promise.reject(error);
          }
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      const accessToken = await ensureAccessToken(true);

      if (accessToken) {
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

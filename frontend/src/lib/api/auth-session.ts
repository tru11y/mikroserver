const AUTH_BYPASS_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/password-reset/request',
  '/auth/password-reset/confirm',
];

function decodeBase64Url(value: string): string | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded);
    }

    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function shouldBypassSessionAuth(url: string | undefined): boolean {
  const value = (url ?? '').trim().toLowerCase();
  if (!value) {
    return false;
  }

  return AUTH_BYPASS_PATHS.some((path) => value.includes(path));
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length < 2 || !segments[1]) {
    return null;
  }

  const decoded = decodeBase64Url(segments[1]);
  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function isJwtExpiredOrExpiringSoon(
  token: string,
  nowMs = Date.now(),
  graceSeconds = 30,
): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.['exp'];

  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return true;
  }

  return exp * 1000 <= nowMs + graceSeconds * 1000;
}

import {
  decodeJwtPayload,
  isJwtExpiredOrExpiringSoon,
  shouldBypassSessionAuth,
} from './auth-session';

function createJwt(expSecondsFromNow: number, nowMs: number) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-1',
      exp: Math.floor(nowMs / 1000) + expSecondsFromNow,
    }),
  ).toString('base64url');

  return `${header}.${payload}.signature`;
}

describe('auth session helpers', () => {
  it('knows which auth routes must bypass session interception', () => {
    expect(shouldBypassSessionAuth('/auth/login')).toBe(true);
    expect(shouldBypassSessionAuth('/proxy/api/v1/auth/refresh')).toBe(true);
    expect(shouldBypassSessionAuth('/auth/password-reset/request')).toBe(true);
    expect(shouldBypassSessionAuth('/routers')).toBe(false);
  });

  it('decodes jwt payload and detects expiring tokens', () => {
    const nowMs = Date.UTC(2026, 2, 25, 12, 0, 0);
    const freshToken = createJwt(300, nowMs);
    const expiringToken = createJwt(10, nowMs);
    const expiredToken = createJwt(-10, nowMs);

    expect(decodeJwtPayload(freshToken)?.['sub']).toBe('user-1');
    expect(isJwtExpiredOrExpiringSoon(freshToken, nowMs, 30)).toBe(false);
    expect(isJwtExpiredOrExpiringSoon(expiringToken, nowMs, 30)).toBe(true);
    expect(isJwtExpiredOrExpiringSoon(expiredToken, nowMs, 30)).toBe(true);
    expect(isJwtExpiredOrExpiringSoon('invalid.token', nowMs, 30)).toBe(true);
  });
});

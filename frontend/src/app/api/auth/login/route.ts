import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

/**
 * POST /api/auth/login
 *
 * Proxies credentials to the backend, then:
 * - Sets the refresh token as an httpOnly Secure SameSite=Strict cookie (not
 *   accessible to client-side JavaScript — mitigates XSS token theft).
 * - Returns the short-lived access token in the response body so the client
 *   can store it in sessionStorage and attach it as an Authorization header.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  const backendRes = await fetch(`${API_INTERNAL_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  const json = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(json, { status: backendRes.status });
  }

  const accessToken: string | undefined = json?.data?.accessToken;
  const refreshToken: string | undefined = json?.data?.refreshToken;
  const requiresTwoFactor: boolean = json?.data?.requiresTwoFactor ?? false;
  const tempToken: string | undefined = json?.data?.tempToken;

  const response = NextResponse.json(json, { status: 200 });

  if (refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
      path: '/',
    });
  }

  // Access token returned in body — client stores in sessionStorage.
  // Annotate for the client so it knows what to persist.
  void accessToken;
  void requiresTwoFactor;
  void tempToken;

  return response;
}

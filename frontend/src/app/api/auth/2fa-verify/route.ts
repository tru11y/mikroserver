import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

/**
 * POST /api/auth/2fa-verify
 *
 * Proxies the 2FA code to the backend, then sets the refresh token as an
 * httpOnly cookie and returns the access token in the response body.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  const backendRes = await fetch(`${API_INTERNAL_URL}/api/v1/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  const json = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(json, { status: backendRes.status });
  }

  const refreshToken: string | undefined = json?.data?.tokens?.refreshToken;
  const response = NextResponse.json(json, { status: 200 });

  if (refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return response;
}

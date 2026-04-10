import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

/**
 * POST /api/auth/refresh
 *
 * Reads the httpOnly refresh_token cookie, forwards it to the backend,
 * sets the new refresh token cookie, and returns the new access token in body.
 * No credentials needed in the request body — the cookie is sent automatically.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  const backendRes = await fetch(`${API_INTERNAL_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });

  const json = await backendRes.json();

  if (!backendRes.ok) {
    // Clear invalid cookie on auth failure
    const errResponse = NextResponse.json(json, { status: backendRes.status });
    errResponse.cookies.delete('refresh_token');
    return errResponse;
  }

  const newRefreshToken: string | undefined = json?.data?.refreshToken;
  const response = NextResponse.json(json, { status: 200 });

  if (newRefreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return response;
}

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

/**
 * POST /api/auth/logout
 *
 * Reads the httpOnly refresh token, calls the backend logout endpoint to
 * revoke the token family, then clears the httpOnly cookie.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value;

  if (refreshToken) {
    // Best-effort: revoke on backend (ignore failure — we clear cookie regardless)
    await fetch(`${API_INTERNAL_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  }

  const response = NextResponse.json({ message: 'Logged out' }, { status: 200 });
  response.cookies.delete('refresh_token');
  return response;
}

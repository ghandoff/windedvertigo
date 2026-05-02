import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Wave 7.0.7 — clear both access and refresh cookies. The refresh cookie
  // is the longer-lived of the two; leaving it behind on logout would let
  // a shared-browser scenario silently re-auth via /api/auth/refresh.
  const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' };
  response.cookies.set(ACCESS_COOKIE, '', cookieBase);
  response.cookies.set(REFRESH_COOKIE, '', cookieBase);
  return response;
}

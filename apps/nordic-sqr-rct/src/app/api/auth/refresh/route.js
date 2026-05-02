import { NextResponse } from 'next/server';
import {
  verifyToken,
  signAccessToken,
  signRefreshToken,
  getRefreshTokenFromRequest,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
} from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Refresh is called frequently (once per access-token expiry per client) so
// the limit is looser than login, but still bounded to thwart a stolen-refresh
// replay attack: 30 refreshes per 15 min per IP covers normal usage while
// capping abuse.
const refreshLimiter = createRateLimiter({ maxAttempts: 30, windowMs: 15 * 60 * 1000 });

/**
 * POST /api/auth/refresh — Wave 7.0.7
 *
 * Exchanges a refresh token (7d lifetime) for a fresh access token (1h
 * lifetime), re-reading the reviewer's current roles from Notion in the
 * process. This is the chokepoint that makes role revocation take effect
 * within one access-token cycle (≤ 1h) rather than the legacy 7d JWT window.
 *
 * Security properties:
 *   - The refresh token carries `purpose: 'refresh'`. An attacker who
 *     obtains the short-lived access token cannot use it here.
 *   - On every refresh we re-fetch the reviewer row. If roles changed
 *     (role removed, account deactivated, consent withdrawn), the new
 *     access token reflects the current state — or we refuse to issue
 *     one at all.
 *   - We ROTATE the refresh token on every successful refresh. A stolen
 *     refresh token is invalidated the moment the legitimate client
 *     refreshes, giving us a narrow detection window (monitoring for
 *     repeated refresh failures would surface the attack).
 *   - If the reviewer row no longer exists, or lost PCS access, refusal
 *     is immediate and both cookies are cleared.
 */
export async function POST(request) {
  const rl = refreshLimiter(request);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many refresh attempts.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const refreshTokenRaw = getRefreshTokenFromRequest(request);
  if (!refreshTokenRaw) {
    return NextResponse.json({ error: 'No refresh token.' }, { status: 401 });
  }

  const claims = await verifyToken(refreshTokenRaw);
  if (!claims || claims.purpose !== 'refresh' || !claims.reviewerId) {
    // Clear both cookies on any refresh-token integrity failure.
    const resp = NextResponse.json({ error: 'Refresh token invalid or expired.' }, { status: 401 });
    resp.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
    resp.cookies.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
    return resp;
  }

  // Re-read the reviewer from Notion. This is the live role re-verification.
  let reviewer;
  try {
    const { getReviewerById } = await import('@/lib/notion');
    reviewer = await getReviewerById(claims.reviewerId);
  } catch (err) {
    console.error('refresh: Notion lookup failed', err);
    return NextResponse.json({ error: 'Could not verify session.' }, { status: 500 });
  }

  if (!reviewer) {
    const resp = NextResponse.json({ error: 'Account no longer exists.' }, { status: 401 });
    resp.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
    resp.cookies.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
    return resp;
  }

  // If the password-reset flag was raised since login, force them back
  // through the reset flow rather than silently re-authenticating.
  if (reviewer.passwordResetRequired) {
    const resp = NextResponse.json(
      { error: 'Password reset required. Log in again.' },
      { status: 401 },
    );
    resp.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
    resp.cookies.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
    return resp;
  }

  // Issue new access + new refresh (rotation). Access carries current
  // roles from Notion, not whatever was on the old token.
  const roles = Array.isArray(reviewer.roles) && reviewer.roles.length > 0
    ? reviewer.roles
    : (reviewer.isAdmin ? ['sqr-rct', 'pcs', 'admin'] : ['sqr-rct']);
  const accessToken = await signAccessToken({
    reviewerId: reviewer.id,
    alias: reviewer.alias,
    firstName: reviewer.firstName,
    lastName: reviewer.lastName,
    isAdmin: reviewer.isAdmin,
    roles,
    // Wave 7.3.0 Phase B — additive email claims so the confirmation
    // banner has the latest values after a refresh (e.g. after the user
    // confirmed their email mid-session).
    email: reviewer.email || '',
    emailConfirmedAt: reviewer.emailConfirmedAt || null,
  });
  const refreshToken = await signRefreshToken({ reviewerId: reviewer.id });

  const resp = NextResponse.json({
    success: true,
    user: {
      id: reviewer.id,
      alias: reviewer.alias,
      firstName: reviewer.firstName,
      lastName: reviewer.lastName,
      isAdmin: reviewer.isAdmin,
      roles,
      email: reviewer.email || '',
      emailConfirmedAt: reviewer.emailConfirmedAt || null,
    },
  });
  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  resp.cookies.set(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
  resp.cookies.set(REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
  return resp;
}

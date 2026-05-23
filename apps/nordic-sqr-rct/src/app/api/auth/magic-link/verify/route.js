/**
 * GET /api/auth/magic-link/verify?token=<jwt>
 *
 * Wave 7.3.1 — Magic link verification endpoint.
 *
 * Validates the short-lived JWT magic-link token, looks up the reviewer,
 * issues access + refresh cookies (identical to /api/auth/login), and
 * redirects to /welcome.
 *
 * On any error the user is redirected to /?error=magic-link-invalid so
 * the login page can surface a friendly message.
 */

import { NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken, ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_MAX_AGE, REFRESH_MAX_AGE } from '@/lib/auth';
import { getReviewerById } from '@/lib/sqr-reviewers';

const ERROR_REDIRECT = '/?error=magic-link-invalid';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
    }

    // Verify the JWT and assert the purpose claim.
    const payload = await verifyToken(token);
    if (!payload || payload.purpose !== 'magic-link') {
      return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
    }

    const { reviewerId } = payload;
    if (!reviewerId) {
      return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
    }

    // Re-read the reviewer to get the latest roles/state.
    let reviewer = null;
    try {
      reviewer = await getReviewerById(reviewerId);
    } catch (err) {
      console.error('[magic-link/verify] getReviewerById failed:', err.message);
      return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
    }

    if (!reviewer) {
      return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
    }

    // Issue session tokens — same logic as /api/auth/login.
    const firstName = reviewer.firstName || '';
    const lastName = reviewer.lastName || '';
    const alias = reviewer.alias || reviewer.email || reviewerId;
    const isAdmin = reviewer.isAdmin || false;
    const roles = reviewer.roles || (isAdmin ? ['sqr-rct', 'pcs', 'admin'] : ['sqr-rct']);
    const reviewerEmail = reviewer.email || '';
    const emailConfirmedAt = reviewer.emailConfirmedAt || null;

    const accessToken = await signAccessToken({
      reviewerId: reviewer.id,
      alias,
      firstName,
      lastName,
      isAdmin,
      roles,
      email: reviewerEmail,
      emailConfirmedAt,
    });
    const refreshToken = await signRefreshToken({ reviewerId: reviewer.id });

    const response = NextResponse.redirect(new URL('/research/pcs', request.url));
    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
    response.cookies.set(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
    response.cookies.set(REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
    return response;
  } catch (err) {
    console.error('[magic-link/verify] Unexpected error:', err);
    return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
  }
}

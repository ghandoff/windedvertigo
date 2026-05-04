import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  getReviewerByAlias,
  getReviewerByEmail,
  updateReviewerPassword,
  setReviewerPasswordResetRequired,
} from '@/lib/notion';
import {
  signToken,
  signAccessToken,
  signRefreshToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
} from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';

const SALT_ROUNDS = 12;

// 5 login attempts per 15-minute window per IP
const loginLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

export async function POST(request) {
  try {
    // Rate-limit before any DB work
    const rl = loginLimiter(request);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    // 2026-05-03 — accept either an email or a legacy alias as the identifier.
    // The form field is now "Email or username" so existing alias-based logins
    // keep working while Nordic users move to canonical-email login. Body
    // schema is backward-compatible: clients can send `{ alias }` (legacy),
    // `{ email }`, or `{ identifier }` (recommended for new clients).
    const body = await request.json();
    const identifier = body?.identifier || body?.email || body?.alias;
    const password = body?.password;
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email (or username) and password are required' },
        { status: 400 },
      );
    }

    // Email matching is preferred when the identifier looks like an email.
    // Fall back to alias for legacy clients and any non-email username string.
    const looksLikeEmail = typeof identifier === 'string' && identifier.includes('@');
    let reviewer = null;
    if (looksLikeEmail) {
      reviewer = await getReviewerByEmail(identifier.trim().toLowerCase());
    }
    if (!reviewer) {
      reviewer = await getReviewerByAlias(identifier);
    }
    if (!reviewer) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const storedPassword = reviewer.properties?.['Password']?.rich_text?.[0]?.plain_text || '';

    // Check if stored password is a bcrypt hash (starts with $2a$ or $2b$)
    const isHashed = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$');

    let passwordValid = false;
    if (isHashed) {
      passwordValid = await bcrypt.compare(password, storedPassword);
    } else {
      // Legacy plain-text comparison — migrate to hash on successful login
      // Use constant-time comparison to prevent timing attacks
      const a = Buffer.from(storedPassword, 'utf8');
      const b = Buffer.from(password, 'utf8');
      passwordValid = a.length === b.length && timingSafeEqual(a, b);
      if (passwordValid) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await updateReviewerPassword(reviewer.id, hashedPassword);
        // Wave 7.0.7 — any password we find in the clear gets flagged for
        // reset, regardless of whether the backfill script ran first. The
        // user chose their password when it was exposed; they should rotate.
        await setReviewerPasswordResetRequired(reviewer.id, true);
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid alias or password' }, { status: 401 });
    }

    // Wave 7.0.7 — forced-reset intercept. If the reviewer's row carries
    // the "Password reset required" flag (set by the bcrypt backfill script
    // or by the plain-text migration above), do NOT issue a full session
    // token. Instead return a short-lived reset grant that the
    // /api/auth/reset-password endpoint will validate.
    const resetRequired =
      reviewer.properties?.['Password reset required']?.checkbox === true;
    if (resetRequired) {
      const resetToken = await signToken(
        { reviewerId: reviewer.id, purpose: 'password-reset' },
        { expiresIn: '10m' },
      );
      const resp = NextResponse.json({
        success: false,
        resetRequired: true,
        message: 'Password reset required before you can sign in.',
      });
      resp.cookies.set('sqr_reset_grant', resetToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60,
        path: '/',
      });
      return resp;
    }

    const firstName = reviewer.properties?.['First Name']?.title?.[0]?.plain_text || '';
    const lastName = reviewer.properties?.['Last Name (Surname)']?.rich_text?.[0]?.plain_text || '';
    const reviewerAlias = reviewer.properties?.['Alias']?.rich_text?.[0]?.plain_text || alias;
    const isAdmin = reviewer.properties?.['Admin']?.checkbox || false;
    const explicitRoles = (reviewer.properties?.['Roles']?.multi_select || []).map(s => s.name);
    const roles = explicitRoles.length > 0
      ? explicitRoles
      : isAdmin ? ['sqr-rct', 'pcs', 'admin'] : ['sqr-rct'];
    // Wave 7.3.0 Phase B — seed email + emailConfirmedAt into the JWT so
    // the Email Confirmation Banner can decide whether to render without
    // an extra Notion round-trip.
    const reviewerEmail = reviewer.properties?.['Email']?.email || '';
    const emailConfirmedAt =
      reviewer.properties?.['Email confirmed at']?.date?.start || null;
    // Wave 7.0.7 — split access (1h) + refresh (7d) tokens. Access carries
    // the full session claim set; refresh is minimal (reviewerId + purpose)
    // and only usable at /api/auth/refresh, which re-reads roles from Notion.
    const accessToken = await signAccessToken({
      reviewerId: reviewer.id,
      alias: reviewerAlias,
      firstName,
      lastName,
      isAdmin,
      roles,
      email: reviewerEmail,
      emailConfirmedAt,
    });
    const refreshToken = await signRefreshToken({ reviewerId: reviewer.id });
    const response = NextResponse.json({
      success: true,
      user: {
        id: reviewer.id,
        alias: reviewerAlias,
        firstName,
        lastName,
        isAdmin,
        roles,
        email: reviewerEmail,
        emailConfirmedAt,
      },
    });
    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
    response.cookies.set(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
    response.cookies.set(REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

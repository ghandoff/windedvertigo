import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getReviewerByAlias, createReviewer } from '@/lib/notion';
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
} from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';

const SALT_ROUNDS = 12;

// 3 registration attempts per hour per IP
const registerLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 60 * 60 * 1000 });

export async function POST(request) {
  try {
    // Rate-limit before any DB work
    const rl = registerLimiter(request);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    const data = await request.json();
    const required = ['firstName', 'lastName', 'email', 'alias', 'password'];
    for (const field of required) {
      if (!data[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }
    if (data.password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters long' }, { status: 400 });
    }
    const existing = await getReviewerByAlias(data.alias);
    if (existing) {
      return NextResponse.json({ error: 'This alias is already taken. Please choose another.' }, { status: 409 });
    }
    if (!data.consent) {
      return NextResponse.json({ error: 'You must consent to share your personal information' }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const page = await createReviewer({ firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim(), affiliation: data.affiliation?.trim() || '', alias: data.alias.trim(), password: hashedPassword, discipline: data.discipline?.trim() || '', consent: true });
    const roles = ['sqr-rct']; // New registrations default to SQR-RCT access
    // Wave 7.0.7 — dual-token issue (access 1h + refresh 7d).
    const accessToken = await signAccessToken({ reviewerId: page.id, alias: data.alias.trim(), firstName: data.firstName.trim(), lastName: data.lastName.trim(), isAdmin: false, roles });
    const refreshToken = await signRefreshToken({ reviewerId: page.id });
    const response = NextResponse.json({ success: true, user: { id: page.id, alias: data.alias.trim(), firstName: data.firstName.trim(), lastName: data.lastName.trim(), isAdmin: false, roles } });
    const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
    response.cookies.set(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
    response.cookies.set(REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

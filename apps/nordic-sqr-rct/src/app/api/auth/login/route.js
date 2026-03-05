import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { getReviewerByAlias, updateReviewerPassword } from '@/lib/notion';
import { signToken } from '@/lib/auth';
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

    const { alias, password } = await request.json();
    if (!alias || !password) {
      return NextResponse.json({ error: 'Alias and password are required' }, { status: 400 });
    }
    const reviewer = await getReviewerByAlias(alias);
    if (!reviewer) {
      return NextResponse.json({ error: 'Invalid alias or password' }, { status: 401 });
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
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid alias or password' }, { status: 401 });
    }
    const firstName = reviewer.properties?.['First Name']?.title?.[0]?.plain_text || '';
    const lastName = reviewer.properties?.['Last Name (Surname)']?.rich_text?.[0]?.plain_text || '';
    const reviewerAlias = reviewer.properties?.['Alias']?.rich_text?.[0]?.plain_text || alias;
    const isAdmin = reviewer.properties?.['Admin']?.checkbox || false;
    const token = await signToken({ reviewerId: reviewer.id, alias: reviewerAlias, firstName, lastName, isAdmin });
    const response = NextResponse.json({ success: true, user: { id: reviewer.id, alias: reviewerAlias, firstName, lastName, isAdmin } });
    response.cookies.set('sqr_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

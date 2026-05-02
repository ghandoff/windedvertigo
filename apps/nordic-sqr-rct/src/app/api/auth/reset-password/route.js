import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/lib/auth';
import { updateReviewerPasswordAndClearResetFlag, getReviewerById } from '@/lib/notion';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;

// Tight limit: 3 resets per 15 min per IP. An attacker who grabs a reset
// grant should not be able to brute-force weak password policy attempts.
const resetLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 15 * 60 * 1000 });

/**
 * POST /api/auth/reset-password
 *
 * Consumes the short-lived `sqr_reset_grant` cookie issued by /api/auth/login
 * when a reviewer's row carries `Password reset required = true`. Writes a
 * fresh bcrypt hash and clears the reset flag atomically.
 *
 * Body: { newPassword: string }
 *
 * Intentionally does NOT issue a session token on success — the client is
 * expected to redirect back to /login and authenticate normally with the
 * new password. This keeps the reset flow stateless and makes "I forgot my
 * new password" one retry away instead of leaving the user in a weird
 * half-authenticated state.
 */
export async function POST(request) {
  const rl = resetLimiter(request);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many reset attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const grantToken = request.cookies?.get('sqr_reset_grant')?.value;
  if (!grantToken) {
    return NextResponse.json(
      { error: 'No active password reset session. Log in again to start a reset.' },
      { status: 401 },
    );
  }

  const claims = await verifyToken(grantToken);
  if (!claims || claims.purpose !== 'password-reset' || !claims.reviewerId) {
    return NextResponse.json(
      { error: 'Reset session expired or invalid. Log in again to start a new reset.' },
      { status: 401 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { newPassword } = body || {};
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  // Basic additional policy: must contain at least one of each of upper,
  // lower, digit. Deliberately not a full zxcvbn gate — keeps UX sane.
  if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json(
      { error: 'Password must include upper-case, lower-case, and a digit.' },
      { status: 400 },
    );
  }

  // Confirm the reviewer still exists before we write anything.
  const reviewer = await getReviewerById(claims.reviewerId);
  if (!reviewer) {
    return NextResponse.json({ error: 'Reviewer no longer exists.' }, { status: 404 });
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  try {
    await updateReviewerPasswordAndClearResetFlag(claims.reviewerId, hashed);
  } catch (err) {
    console.error('reset-password: Notion write failed', err);
    return NextResponse.json(
      { error: 'Could not save new password. Please try again in a moment.' },
      { status: 500 },
    );
  }

  const resp = NextResponse.json({
    success: true,
    message: 'Password reset. Please log in with your new password.',
  });
  // Clear the grant cookie so it can't be replayed.
  resp.cookies.set('sqr_reset_grant', '', { httpOnly: true, maxAge: 0, path: '/' });
  return resp;
}

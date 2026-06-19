/**
 * POST /api/auth/magic-link
 *
 * Wave 7.3.1 — Magic link request endpoint for external reviewers.
 *
 * Accepts { email } and, if the email matches an active reviewer account,
 * sends a signed short-lived JWT magic link to that address via Resend.
 *
 * Security notes:
 *   - Always returns 200 even if the email doesn't match a reviewer.
 *     This prevents user enumeration (attacker can't tell which emails
 *     have accounts). The UX copy reflects this ("If that address is
 *     on file, a link is on the way").
 *   - Rate-limited to 3 requests per 15 min per IP — prevents link spam.
 *   - Token TTL is 15 min and purpose-scoped ('magic-link') to prevent
 *     reuse as any other token type.
 *   - Token is a JOSE-signed JWT using the same JWT_SECRET as the rest
 *     of the auth system — no separate storage needed.
 */

import { NextResponse } from 'next/server';
import { getReviewerByEmail } from '@/lib/sqr-reviewers';
import { signToken } from '@/lib/auth';
import { sendMagicLink } from '@/lib/email';
import { createRateLimiter } from '@/lib/rate-limit';

// Magic link TTL must match the EXPIRES_MINUTES constant in email.js.
const MAGIC_LINK_TTL_MINUTES = 15;
const MAGIC_LINK_TTL = `${MAGIC_LINK_TTL_MINUTES}m`;

// 3 magic-link requests per 15-minute window per IP.
const magicLinkLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 15 * 60 * 1000 });

export async function POST(request) {
  try {
    // Rate limit before any DB or email work.
    const rl = magicLinkLimiter(request);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = body?.email;
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    // Silent success: do not reveal whether the email exists.
    const silentSuccess = NextResponse.json({
      success: true,
      message: "If that address is on file, a sign-in link is on the way. Check your inbox (and spam folder).",
    });

    let reviewer = null;
    try {
      reviewer = await getReviewerByEmail(email);
    } catch (err) {
      console.error('[magic-link] getReviewerByEmail failed:', err.message);
      // Fall through — return silent success so the endpoint isn't fingerprintable.
      return silentSuccess;
    }

    if (!reviewer) {
      // No match — return the same envelope as a real send to prevent enumeration.
      return silentSuccess;
    }

    // Build the signed JWT magic-link token.
    const token = await signToken(
      {
        reviewerId: reviewer.id,
        email: reviewer.email || email,
        purpose: 'magic-link',
      },
      { expiresIn: MAGIC_LINK_TTL },
    );

    // Build the full verify URL using the request's origin.
    const origin = request.headers.get('origin') || request.nextUrl?.origin || '';
    const redirectPath = (body?.redirect && typeof body.redirect === 'string' && body.redirect.startsWith('/'))
      ? body.redirect : null;
    const verifyUrl = `${origin}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`
      + (redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : '');

    // Send the email. On Resend error we log but still return success so the
    // UX copy ("if that address is on file...") stays consistent.
    try {
      await sendMagicLink({
        to: reviewer.email || email,
        name: reviewer.firstName || '',
        url: verifyUrl,
      });
    } catch (emailErr) {
      console.error('[magic-link] sendMagicLink failed:', emailErr.message);
      // Return silent success — the error is logged server-side. The
      // alternative (exposing the error) leaks delivery information.
    }

    return silentSuccess;
  } catch (err) {
    console.error('[magic-link] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

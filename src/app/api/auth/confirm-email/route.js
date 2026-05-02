import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import {
  getReviewerByEmail,
  getReviewerById,
  updateReviewerEmail,
} from '@/lib/notion';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * POST /api/auth/confirm-email — Wave 7.3.0 Phase B.
 *
 * Authenticated endpoint used by EmailConfirmationBanner to write a
 * confirmed email-as-key onto the reviewer's row. Server-side validates
 * shape, enforces case-insensitive uniqueness across the Reviewers DB,
 * and stamps `Email confirmed at = now()`.
 */
export async function POST(request) {
  const session = await authenticateRequest(request);
  if (!session?.reviewerId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!raw) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(raw)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const normalized = raw.toLowerCase();

  try {
    // Uniqueness check — Notion has no DB-level unique constraint, so we
    // enforce it in code. Race-safe enough for Nordic's write volume.
    const existing = await getReviewerByEmail(normalized);
    if (existing && existing.id !== session.reviewerId) {
      return NextResponse.json(
        { error: 'Email already in use by another account.' },
        { status: 409 },
      );
    }

    await updateReviewerEmail(session.reviewerId, normalized);
    const updated = await getReviewerById(session.reviewerId);

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        alias: updated.alias,
        firstName: updated.firstName,
        lastName: updated.lastName,
        isAdmin: updated.isAdmin,
        roles: updated.roles,
        email: updated.email,
        emailConfirmedAt: updated.emailConfirmedAt,
      },
    });
  } catch (error) {
    console.error('confirm-email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

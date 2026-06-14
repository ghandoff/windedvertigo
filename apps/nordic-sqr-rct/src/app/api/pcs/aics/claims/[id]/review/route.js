/**
 * POST /api/pcs/aics/claims/[id]/review
 * Capability: aics.claims:review
 *
 * Submit an approve/reject decision for an AICS claim. The [id] param is the
 * notion_page_id of the AICS claim being reviewed.
 *
 * Body: { decision: 'approved' | 'rejected', notes?: string }
 *
 * reviewer_type is derived from the caller's roles:
 *   - ra, researcher, admin, super-user → 'internal'
 *   - aics-reviewer only → 'contractor'
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { createAicsClaimReview, findExistingReview } from '@/lib/aics-reviews';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'aics.claims:review', {
    route: '/api/pcs/aics/claims/[id]/review',
  });
  if (auth.error) return auth.error;

  const { user } = auth;
  const aicsClaimId = params.id;
  if (!aicsClaimId) {
    return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.decision) {
    return NextResponse.json({ error: 'Body must include { decision: "approved" | "rejected" }' }, { status: 400 });
  }

  const { decision, notes } = body;
  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be "approved" or "rejected"' }, { status: 400 });
  }

  // Derive reviewer type from roles
  const internalRoles = ['ra', 'researcher', 'admin', 'super-user'];
  const isInternal = user.roles?.some(r => internalRoles.includes(r));
  const reviewerType = isInternal ? 'internal' : 'contractor';

  // Idempotency: one review per reviewer per claim
  const existing = await findExistingReview(aicsClaimId, user.reviewerId || user.id);
  if (existing) {
    return NextResponse.json(
      { error: 'You have already submitted a review for this claim', existingReview: existing },
      { status: 409 },
    );
  }

  try {
    const review = await createAicsClaimReview({
      aicsClaimId,
      reviewerId: user.reviewerId || user.id,
      reviewerType,
      decision,
      notes: notes?.trim() || null,
    });
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    console.error('[aics/claims/review] failed:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Review submission failed' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'aics.claims:review', {
    route: '/api/pcs/aics/claims/[id]/review',
  });
  if (auth.error) return auth.error;

  const { getReviewsForClaim } = await import('@/lib/aics-reviews');
  const reviews = await getReviewsForClaim(params.id);
  return NextResponse.json({ ok: true, reviews });
}

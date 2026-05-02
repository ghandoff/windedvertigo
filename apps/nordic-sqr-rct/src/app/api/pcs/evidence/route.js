import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllEvidence, getEvidenceByIngredient, getEvidenceByType,
  getSqrReviewedEvidence, getUnreviewedEvidence, createEvidence,
} from '@/lib/pcs-evidence';
import { isAutoFeedEnabled, feedToIntake } from '@/lib/pcs-intake-feed';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const ingredient = searchParams.get('ingredient');
  const type = searchParams.get('type');
  const sqrReviewed = searchParams.get('sqrReviewed');

  let evidence;
  if (ingredient) {
    evidence = await getEvidenceByIngredient(ingredient);
  } else if (type) {
    evidence = await getEvidenceByType(type);
  } else if (sqrReviewed === 'true') {
    evidence = await getSqrReviewedEvidence();
  } else if (sqrReviewed === 'false') {
    evidence = await getUnreviewedEvidence();
  } else {
    evidence = await getAllEvidence();
  }
  return NextResponse.json(evidence);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:attach', { route: '/api/pcs/evidence' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const entry = await createEvidence(fields);

  // Fire-and-forget: auto-feed to SQR-RCT intake queue if enabled
  if (isAutoFeedEnabled()) {
    feedToIntake(entry)
      .then(r => r.status === 'created' && process.env.NODE_ENV !== 'production' && console.log('[auto-feed] queued for review:', entry.name))
      .catch(err => console.error('[auto-feed] failed:', entry.name, err.message));
  }

  return NextResponse.json(entry, { status: 201 });
}

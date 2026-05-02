import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getClaim, updateClaim } from '@/lib/pcs-claims';
import {
  CLAIM_STATUSES, CLAIM_BUCKETS,
  HETEROGENEITY, PUBLICATION_BIAS, FUNDING_BIAS, PRECISION,
  EFFECT_SIZE_CATEGORIES, DOSE_RESPONSE_GRADIENT, CERTAINTY_RATINGS,
} from '@/lib/pcs-config';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/claims/[id]' });
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const claim = await getClaim(id);
    return NextResponse.json(claim);
  } catch (err) {
    console.error('Claim GET error:', err);
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.claims:edit', { route: '/api/pcs/claims/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  let fields;
  try {
    fields = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate enum fields
  if (fields.claimStatus && !CLAIM_STATUSES.includes(fields.claimStatus)) {
    return NextResponse.json({ error: `Invalid claim status: ${fields.claimStatus}` }, { status: 400 });
  }
  if (fields.claimBucket && !CLAIM_BUCKETS.includes(fields.claimBucket)) {
    return NextResponse.json({ error: `Invalid claim bucket: ${fields.claimBucket}` }, { status: 400 });
  }
  // NutriGrade body-of-evidence fields (Phase 4)
  const nutrigradeEnums = [
    ['heterogeneity', HETEROGENEITY],
    ['publicationBias', PUBLICATION_BIAS],
    ['fundingBias', FUNDING_BIAS],
    ['precision', PRECISION],
    ['effectSizeCategory', EFFECT_SIZE_CATEGORIES],
    ['doseResponseGradient', DOSE_RESPONSE_GRADIENT],
    ['certaintyRating', CERTAINTY_RATINGS],
  ];
  for (const [key, valid] of nutrigradeEnums) {
    if (fields[key] && !valid.includes(fields[key])) {
      return NextResponse.json({ error: `Invalid ${key}: ${fields[key]}` }, { status: 400 });
    }
  }

  // Rejection requires a note
  if (fields.claimStatus === 'Not approved' && !fields.claimNotes?.trim()) {
    const existing = await getClaim(id);
    if (!existing.claimNotes?.trim()) {
      return NextResponse.json(
        { error: 'A rejection note is required when setting status to Not approved' },
        { status: 400 }
      );
    }
  }

  try {
    const claim = await updateClaim(id, fields);
    return NextResponse.json(claim);
  } catch (err) {
    console.error('Claim PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }
}

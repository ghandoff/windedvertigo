import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth/require-capability';
import { getClaim, updateClaim, updateClaimField } from '@/lib/pcs-claims';
import {
  CLAIM_STATUSES, CLAIM_BUCKETS,
  HETEROGENEITY, PUBLICATION_BIAS, FUNDING_BIAS, PRECISION,
  EFFECT_SIZE_CATEGORIES, DOSE_RESPONSE_GRADIENT, CERTAINTY_RATINGS,
  CLAIM_AUTHORITY_REGIONS,
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

  // Living View inline editing adds these core text/number fields (Part 7C).
  // No extra validation needed — they are passed directly to updateClaim().
  // Numeric coercion: ensure minDoseMg / maxDoseMg are numbers or null.
  for (const numField of ['minDoseMg', 'maxDoseMg', 'claimNo']) {
    if (fields[numField] !== undefined && fields[numField] !== null && fields[numField] !== '') {
      const n = Number(fields[numField]);
      if (isNaN(n)) {
        return NextResponse.json({ error: `${numField} must be a number` }, { status: 400 });
      }
      fields[numField] = n;
    } else if (fields[numField] === '' || fields[numField] === null) {
      fields[numField] = null;
    }
  }

  // authorityRegions must be a subset of CLAIM_AUTHORITY_REGIONS
  if (fields.authorityRegions !== undefined) {
    if (!Array.isArray(fields.authorityRegions)) {
      return NextResponse.json({ error: 'authorityRegions must be an array' }, { status: 400 });
    }
    const invalid = fields.authorityRegions.filter(r => !CLAIM_AUTHORITY_REGIONS.includes(r));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Unknown authority regions: ${invalid.join(', ')}` }, { status: 400 });
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

  // Authority/region applicability is a regulatory-compliance decision, so it
  // is routed through the audited single-field path (updateClaimField → mutate)
  // which records who set it and when in the PCS Revisions log. Other inline
  // fields keep their existing (non-audited) bulk write.
  const { authorityRegions, ...rest } = fields;
  const actor = {
    email: auth.user?.email || auth.user?.alias || 'unknown@nordic-sqr-rct',
    roles: Array.isArray(auth.user?.roles) && auth.user.roles.length > 0 ? auth.user.roles : [],
  };

  try {
    let claim = null;
    if (Object.keys(rest).length > 0) {
      claim = await updateClaim(id, rest);
    }
    if (authorityRegions !== undefined) {
      claim = await updateClaimField({
        id,
        fieldPath: 'authorityRegions',
        value: authorityRegions,
        actor,
        reason: 'Authority/region applicability set via Claims editor',
      });
    }
    if (claim === null) {
      claim = await getClaim(id);
    }
    revalidatePath('/api/pcs/claims');
    return NextResponse.json(claim);
  } catch (err) {
    console.error('Claim PATCH error:', err);
    if (err?.code === 'invalid-value' || err?.code === 'field-not-allowed') {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }
}

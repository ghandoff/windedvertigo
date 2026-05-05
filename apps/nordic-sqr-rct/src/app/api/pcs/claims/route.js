import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllClaims, getClaimsForVersion, getClaimsByBucket,
  getClaimsWithoutEvidence, createClaim,
} from '@/lib/pcs-claims';

export const revalidate = 60;

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/claims' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId');
  const bucket = searchParams.get('bucket');
  const noEvidence = searchParams.get('noEvidence');

  let claims;
  if (versionId) {
    claims = await getClaimsForVersion(versionId);
  } else if (bucket) {
    claims = await getClaimsByBucket(bucket);
  } else if (noEvidence === 'true') {
    claims = await getClaimsWithoutEvidence();
  } else {
    claims = await getAllClaims();
  }
  return NextResponse.json(claims, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  });
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.claims:author', { route: '/api/pcs/claims' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.claim) {
    return NextResponse.json({ error: 'claim text is required' }, { status: 400 });
  }
  const claim = await createClaim(fields);
  revalidatePath('/api/pcs/claims');
  return NextResponse.json(claim, { status: 201 });
}

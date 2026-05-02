import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllCanonicalClaims, getCanonicalClaimsByFamily } from '@/lib/pcs-canonical-claims';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/canonical-claims' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const family = searchParams.get('family');

  const claims = family
    ? await getCanonicalClaimsByFamily(family)
    : await getAllCanonicalClaims();
  return NextResponse.json(claims);
}

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllClaimDoseReqs,
  getReqsForClaim,
  createClaimDoseReq,
} from '@/lib/pcs-claim-dose-reqs';
import { AI_UNITS } from '@/lib/pcs-config';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/claim-dose-reqs' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const claimId = searchParams.get('claimId');

  const rows = claimId ? await getReqsForClaim(claimId) : await getAllClaimDoseReqs();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/claim-dose-reqs' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (fields.unit && !AI_UNITS.includes(fields.unit)) {
    return NextResponse.json({ error: `Invalid unit: ${fields.unit}` }, { status: 400 });
  }
  const row = await createClaimDoseReq(fields);
  return NextResponse.json(row, { status: 201 });
}

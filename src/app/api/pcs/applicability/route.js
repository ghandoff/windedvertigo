import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllApplicability,
  getApplicabilityForClaim,
  getApplicabilityForEvidence,
  createApplicability,
} from '@/lib/applicability';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.applicability:read', { route: '/api/pcs/applicability' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const claimId = searchParams.get('claimId');
  const evidenceItemId = searchParams.get('evidenceItemId');

  let rows;
  if (claimId) rows = await getApplicabilityForClaim(claimId);
  else if (evidenceItemId) rows = await getApplicabilityForEvidence(evidenceItemId);
  else rows = await getAllApplicability();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.applicability:edit', { route: '/api/pcs/applicability' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  const row = await createApplicability(fields);
  return NextResponse.json(row, { status: 201 });
}

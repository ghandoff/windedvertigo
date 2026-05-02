import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllEvidencePackets, getPacketsForClaim, getPacketsForEvidenceItem,
  getPacketsNeedingRole, createEvidencePacket,
} from '@/lib/pcs-evidence-packets';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence-packets' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const claimId = searchParams.get('claimId');
  const evidenceItemId = searchParams.get('evidenceItemId');
  const needsRole = searchParams.get('needsRole');

  let packets;
  if (claimId) {
    packets = await getPacketsForClaim(claimId);
  } else if (evidenceItemId) {
    packets = await getPacketsForEvidenceItem(evidenceItemId);
  } else if (needsRole === 'true') {
    packets = await getPacketsNeedingRole();
  } else {
    packets = await getAllEvidencePackets();
  }
  return NextResponse.json(packets);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:edit', { route: '/api/pcs/evidence-packets' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  const packet = await createEvidencePacket(fields);
  return NextResponse.json(packet, { status: 201 });
}

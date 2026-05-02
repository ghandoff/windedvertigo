import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getClaimDoseReq,
  updateClaimDoseReq,
  deleteClaimDoseReq,
} from '@/lib/pcs-claim-dose-reqs';
import { AI_UNITS } from '@/lib/pcs-config';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/claim-dose-reqs/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getClaimDoseReq(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/claim-dose-reqs/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  if (fields.unit && !AI_UNITS.includes(fields.unit)) {
    return NextResponse.json({ error: `Invalid unit: ${fields.unit}` }, { status: 400 });
  }
  const row = await updateClaimDoseReq(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/claim-dose-reqs/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deleteClaimDoseReq(id);
  return NextResponse.json({ ok: true });
}

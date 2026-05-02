import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getEvidencePacket, updateEvidencePacket, deleteEvidencePacket } from '@/lib/pcs-evidence-packets';
import { EVIDENCE_ROLES } from '@/lib/pcs-config';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence-packets/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  const packet = await getEvidencePacket(id);
  return NextResponse.json(packet);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:edit', { route: '/api/pcs/evidence-packets/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  let fields;
  try {
    fields = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate evidence role enum
  if (fields.evidenceRole && !EVIDENCE_ROLES.includes(fields.evidenceRole)) {
    return NextResponse.json({ error: `Invalid evidence role: ${fields.evidenceRole}` }, { status: 400 });
  }

  try {
    const packet = await updateEvidencePacket(id, fields);
    return NextResponse.json(packet);
  } catch (err) {
    console.error('Evidence packet PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update evidence packet' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:edit', { route: '/api/pcs/evidence-packets/[id]' });
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    await deleteEvidencePacket(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Failed to delete evidence packet:', err);
    return NextResponse.json({ error: 'Failed to delete evidence packet' }, { status: 500 });
  }
}

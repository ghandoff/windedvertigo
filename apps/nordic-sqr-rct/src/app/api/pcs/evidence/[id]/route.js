import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getEvidence, updateEvidence } from '@/lib/pcs-evidence';
import { EVIDENCE_TYPES, SQR_RISK_OF_BIAS } from '@/lib/pcs-config';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence/[id]' });
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const entry = await getEvidence(id);
    return NextResponse.json(entry);
  } catch (err) {
    console.error('Evidence GET error:', err);
    return NextResponse.json({ error: 'Evidence item not found' }, { status: 404 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:edit', { route: '/api/pcs/evidence/[id]' });
  if (auth.error) return auth.error;

  let fields;
  try {
    fields = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate enum fields
  if (fields.evidenceType && !EVIDENCE_TYPES.includes(fields.evidenceType)) {
    return NextResponse.json({ error: `Invalid evidence type: ${fields.evidenceType}` }, { status: 400 });
  }
  if (fields.sqrRiskOfBias && !SQR_RISK_OF_BIAS.includes(fields.sqrRiskOfBias)) {
    return NextResponse.json({ error: `Invalid SQR risk of bias: ${fields.sqrRiskOfBias}` }, { status: 400 });
  }

  try {
    const { id } = await params;
    const entry = await updateEvidence(id, fields);
    return NextResponse.json(entry);
  } catch (err) {
    console.error('Evidence PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update evidence item' }, { status: 500 });
  }
}

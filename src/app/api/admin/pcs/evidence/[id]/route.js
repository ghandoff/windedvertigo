import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  updateEvidencePacketField,
  EVIDENCE_PACKET_EDITABLE_FIELDS,
} from '@/lib/pcs-evidence-packets';
import { EVIDENCE_ROLES, SUBSTANTIATION_TIERS } from '@/lib/pcs-config';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/pcs/evidence/[id] — Wave 8 Phase C4
 *
 * Inline single-field edit for Evidence Packets. Routes through
 * `updateEvidencePacketField` so every change emits a PCS Revisions row via
 * `mutate()`. The allowlist of editable fields lives on the helper; anything
 * else is rejected with 400.
 *
 * Body shape: `{ fieldPath: string, value: any, reason?: string }`.
 *
 * Guarded by the `pcs.evidence:edit` capability (researcher + RA + admin +
 * super-user).
 */
export async function PATCH(request, { params }) {
  const gate = await requireCapability(request, 'pcs.evidence:edit', {
    route: '/api/admin/pcs/evidence/[id]',
  });
  if (gate.error) return gate.error;
  const { user } = gate;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Evidence packet id is required.' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fieldPath = typeof body?.fieldPath === 'string' ? body.fieldPath : null;
  if (!fieldPath) {
    return NextResponse.json(
      { error: 'fieldPath is required.', allowed: EVIDENCE_PACKET_EDITABLE_FIELDS },
      { status: 400 },
    );
  }
  if (!EVIDENCE_PACKET_EDITABLE_FIELDS.includes(fieldPath)) {
    return NextResponse.json(
      { error: `Field "${fieldPath}" is not editable.`, allowed: EVIDENCE_PACKET_EDITABLE_FIELDS },
      { status: 400 },
    );
  }

  // Enum validation for select fields.
  if (fieldPath === 'evidenceRole' && body.value && !EVIDENCE_ROLES.includes(body.value)) {
    return NextResponse.json(
      { error: `Invalid evidence role: ${body.value}`, allowed: EVIDENCE_ROLES },
      { status: 400 },
    );
  }
  if (fieldPath === 'substantiationTier' && body.value && !SUBSTANTIATION_TIERS.includes(body.value)) {
    return NextResponse.json(
      { error: `Invalid substantiation tier: ${body.value}`, allowed: SUBSTANTIATION_TIERS },
      { status: 400 },
    );
  }

  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 1000) : undefined;

  const actor = {
    email: user?.email || user?.alias || 'unknown@nordic-sqr-rct',
    roles: Array.isArray(user?.roles) ? user.roles : [],
  };

  try {
    const updated = await updateEvidencePacketField({
      id,
      fieldPath,
      value: body.value,
      actor,
      reason,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err?.code === 'allowlist') {
      return NextResponse.json(
        { error: err.message, allowed: EVIDENCE_PACKET_EDITABLE_FIELDS },
        { status: 400 },
      );
    }
    console.error('[api] PATCH evidence packet failed:', err);
    return NextResponse.json(
      { error: 'Failed to update evidence packet', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

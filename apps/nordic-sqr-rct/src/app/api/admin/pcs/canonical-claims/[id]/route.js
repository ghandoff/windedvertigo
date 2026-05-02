import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getCanonicalClaim,
  isEditableCanonicalClaimField,
  updateCanonicalClaimField,
  CANONICAL_CLAIM_EDITABLE_FIELDS,
} from '@/lib/pcs-canonical-claims';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pcs/canonical-claims/[id]
 *
 * Wave 8 Phase C1 — hydrate a canonical claim for the inline-edit detail
 * view. Guarded by `pcs.claims:read` (everyone on PCS can see canonicals).
 */
export async function GET(request, { params }) {
  const gate = await requireCapability(request, 'pcs.claims:read', {
    route: '/api/admin/pcs/canonical-claims/[id]',
  });
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id path parameter is required.' }, { status: 400 });
  }
  try {
    const row = await getCanonicalClaim(id);
    return NextResponse.json(row);
  } catch (err) {
    console.error('[api] GET canonical-claim failed:', err);
    return NextResponse.json(
      { error: 'Canonical claim fetch failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/pcs/canonical-claims/[id]
 *
 * Wave 8 Phase C1 — inline edit of a single allowlisted canonical-claim field.
 * Every write routes through `mutate()` so a PCS Revisions row is logged with
 * before/after snapshots; without a logged revision the mutation fails closed.
 *
 * Body: { fieldPath: string, value: any, reason?: string }
 *
 * Allowlist (see CANONICAL_CLAIM_EDITABLE_FIELDS): title, prefix,
 * benefitCategory, activeIngredient, claimFamily, notesGuardrails,
 * dedupeDecision. Anything else → 400.
 */
export async function PATCH(request, { params }) {
  const gate = await requireCapability(request, 'pcs.canonical:edit', {
    route: '/api/admin/pcs/canonical-claims/[id]',
  });
  if (gate.error) return gate.error;
  const { user } = gate;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id path parameter is required.' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { fieldPath, value, reason } = body || {};

  if (!fieldPath || typeof fieldPath !== 'string') {
    return NextResponse.json(
      { error: 'fieldPath is required.', allowedFields: Object.keys(CANONICAL_CLAIM_EDITABLE_FIELDS) },
      { status: 400 },
    );
  }
  if (!isEditableCanonicalClaimField(fieldPath)) {
    return NextResponse.json(
      {
        error: `fieldPath "${fieldPath}" is not editable.`,
        allowedFields: Object.keys(CANONICAL_CLAIM_EDITABLE_FIELDS),
      },
      { status: 400 },
    );
  }

  try {
    const updated = await updateCanonicalClaimField({
      id,
      fieldPath,
      value,
      actor: { email: user.email || user.alias, roles: user.roles || [] },
      reason: reason || undefined,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api] PATCH canonical-claim failed:', err);
    return NextResponse.json(
      {
        error: 'Canonical claim update failed',
        message: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}

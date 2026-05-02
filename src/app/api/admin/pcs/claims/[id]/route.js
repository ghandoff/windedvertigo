import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { updateClaimField } from '@/lib/pcs-claims';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/pcs/claims/[id] — Wave 8 Phase C3
 *
 * Inline-edit endpoint for Claims. Routes writes through
 * `updateClaimField()` which logs a PCS Revisions row per edit.
 *
 * Body: { fieldPath: string, value: any, reason?: string }
 *
 * Allowlisted fieldPaths: claim, claimPrefix, claimBucket, claimStatus,
 * minDoseMg, maxDoseMg, notes. Anything else returns 400.
 */
export async function PATCH(request, { params }) {
  const gate = await requireCapability(request, 'pcs.claims:edit', {
    route: '/api/admin/pcs/claims/[id]',
  });
  if (gate.error) return gate.error;
  const { user } = gate;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Claim id is required.' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { fieldPath, value } = body || {};
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 1000) : undefined;

  if (!fieldPath || typeof fieldPath !== 'string') {
    return NextResponse.json(
      { error: 'fieldPath is required.' },
      { status: 400 },
    );
  }

  const actor = {
    email: user?.email || user?.alias || 'unknown@nordic-sqr-rct',
    roles: Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [],
  };

  try {
    const updated = await updateClaimField({ id, fieldPath, value, actor, reason });
    return NextResponse.json(updated);
  } catch (err) {
    const code = err?.code;
    if (code === 'field-not-allowed' || code === 'invalid-value') {
      return NextResponse.json(
        { error: err.message, code },
        { status: 400 },
      );
    }
    console.error('[api] claim inline-edit failed:', err);
    return NextResponse.json(
      { error: 'Update failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

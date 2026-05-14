/**
 * PATCH /api/pcs/aics/claims/[id]/regulatory — Bundle 3.5 P2
 *
 * Updates the regulatory metadata on an AICS claim:
 *   substantiatingRefs / regulatoryMonographs / safetyLimit /
 *   safetyLimitUnit / safetyNotes.
 *
 * Capability gate: `aics.claims:edit` (RA + admin + super-user).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { updateAicsClaimRegulatory } from '@/lib/aics-documents';

const ALLOWED = new Set([
  'substantiatingRefs',
  'regulatoryMonographs',
  'safetyLimit',
  'safetyLimitUnit',
  'safetyNotes',
]);

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'aics.claims:edit', { route: '/api/pcs/aics/claims/[id]/regulatory' });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'claim id required' }, { status: 400 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON body required' }, { status: 400 }); }

  const fields = {};
  for (const key of Object.keys(body || {})) {
    if (ALLOWED.has(key)) fields[key] = body[key];
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: `at least one of: ${[...ALLOWED].join(', ')}` }, { status: 400 });
  }

  try {
    const updated = await updateAicsClaimRegulatory(id, fields);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'update failed' }, { status: 500 });
  }
}

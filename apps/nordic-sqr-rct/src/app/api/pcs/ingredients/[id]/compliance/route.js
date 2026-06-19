/**
 * Compliance Attributes API — Budget C Marketing Intelligence Layer
 *
 * GET  /api/pcs/ingredients/[id]/compliance
 *   Returns all 15 compliance attributes for the ingredient, with defaults
 *   for any not yet set (status: 'unknown').
 *   Requires: pcs.taxonomy:read
 *
 * PATCH /api/pcs/ingredients/[id]/compliance
 *   Upsert a single compliance attribute.
 *   Body: { attribute: string, status: string, certifiedBy?: string, notes?: string }
 *   Requires: pcs.taxonomy:edit
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getComplianceAttributes,
  upsertComplianceAttribute,
  COMPLIANCE_ATTRIBUTES,
} from '@/lib/compliance-attributes';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', {
    route: '/api/pcs/ingredients/[id]/compliance',
  });
  if (auth.error) return auth.error;

  const { id: ingredientId } = await params;
  const attrs = await getComplianceAttributes(ingredientId);
  return NextResponse.json({ ingredientId, attributes: attrs });
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', {
    route: '/api/pcs/ingredients/[id]/compliance',
  });
  if (auth.error) return auth.error;

  const { id: ingredientId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { attribute, status, certifiedBy, notes } = body || {};

  if (!attribute || !COMPLIANCE_ATTRIBUTES.includes(attribute)) {
    return NextResponse.json(
      { error: `attribute must be one of: ${COMPLIANCE_ATTRIBUTES.join(', ')}` },
      { status: 400 }
    );
  }

  const validStatuses = ['yes', 'no', 'conditional', 'unknown'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  const updated = await upsertComplianceAttribute(ingredientId, attribute, {
    status,
    certifiedBy: certifiedBy || null,
    notes: notes || null,
  });

  return NextResponse.json({ ok: true, attribute: updated }, { status: 200 });
}

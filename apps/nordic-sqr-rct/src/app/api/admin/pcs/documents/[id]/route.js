import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  updateDocumentField,
  DOCUMENT_EDITABLE_FIELDS,
} from '@/lib/pcs-documents';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/pcs/documents/[id]
 *
 * Wave 8 Phase C2 — single-field inline edit for PCS Documents, routed
 * through `updateDocumentField` so every change lands a PCS Revisions row.
 *
 * Body: { fieldPath: string, value: any, reason?: string }
 *
 * Guarded by `pcs.documents:edit`. The legacy bulk PATCH at
 * `/api/pcs/documents/[id]` is left untouched for backwards compatibility.
 */
export async function PATCH(request, { params }) {
  const gate = await requireCapability(request, 'pcs.documents:edit', {
    route: '/api/admin/pcs/documents/[id]',
  });
  if (gate.error) return gate.error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { fieldPath, value, reason } = body || {};
  if (!fieldPath || typeof fieldPath !== 'string') {
    return NextResponse.json(
      { error: 'fieldPath is required.' },
      { status: 400 },
    );
  }
  if (!DOCUMENT_EDITABLE_FIELDS.includes(fieldPath)) {
    return NextResponse.json(
      {
        error: `fieldPath "${fieldPath}" is not editable.`,
        allowed: DOCUMENT_EDITABLE_FIELDS,
      },
      { status: 400 },
    );
  }

  try {
    const doc = await updateDocumentField({
      id,
      fieldPath,
      value,
      actor: { email: gate.user.email, roles: gate.user.roles },
      reason,
    });
    return NextResponse.json(doc);
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    console.error('[api] admin PATCH document failed:', err);
    return NextResponse.json(
      { error: 'Update failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

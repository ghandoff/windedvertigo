/**
 * POST /api/pcs/documents/[id]/linked-aics — link an AICS doc upstream
 * DELETE /api/pcs/documents/[id]/linked-aics?aicsDocumentId=... — unlink
 *
 * Bundle 3.4 P2 — backs the in-platform AICS picker on the PCS detail page.
 * Mutates the `Linked AICS` Notion DUAL relation property added 2026-05-03.
 *
 * Capability gate: `aics.documents:edit` (RA + admin + super-user). Researcher
 * can read links but cannot modify them.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { linkAicsToDocument, unlinkAicsFromDocument } from '@/lib/pcs-documents';

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'aics.documents:edit', { route: '/api/pcs/documents/[id]/linked-aics' });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'document id required' }, { status: 400 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON body required' }, { status: 400 }); }

  const aicsDocumentId = body?.aicsDocumentId;
  if (!aicsDocumentId) return NextResponse.json({ error: 'aicsDocumentId required' }, { status: 400 });

  try {
    const doc = await linkAicsToDocument(id, aicsDocumentId);
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'link failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'aics.documents:edit', { route: '/api/pcs/documents/[id]/linked-aics' });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'document id required' }, { status: 400 });

  const url = new URL(request.url);
  const aicsDocumentId = url.searchParams.get('aicsDocumentId');
  if (!aicsDocumentId) return NextResponse.json({ error: 'aicsDocumentId query param required' }, { status: 400 });

  try {
    const doc = await unlinkAicsFromDocument(id, aicsDocumentId);
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'unlink failed' }, { status: 500 });
  }
}

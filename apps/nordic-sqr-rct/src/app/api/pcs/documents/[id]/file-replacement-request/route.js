/**
 * POST /api/pcs/documents/[id]/file-replacement-request — 2026-05-04
 *
 * Files a PCS Request to RES asking for re-upload of a PCS document under
 * Lauren's v1.0 standardized template. Used when an operator on the
 * /pcs/documents "Needs Replacement" view spots a Legacy / partial /
 * no-template-version document.
 *
 * Capability: pcs.requests:create (researchers + RA + admin + super-user).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getDocument } from '@/lib/pcs-documents';
import { createRequest } from '@/lib/pcs-requests';

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.requests:create', {
    route: '/api/pcs/documents/[id]/file-replacement-request',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'document id required' }, { status: 400 });

  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 });

  const tv = doc.templateVersion || 'no template recorded';
  const reqText = `Re-upload ${doc.pcsId} under Lauren v1.0 template`;
  const reqNotes =
    `Document ${doc.pcsId}` +
    (doc.finishedGoodName ? ` (${doc.finishedGoodName})` : '') +
    ` currently has template version "${tv}". The standardized PCS template is "Lauren v1.0".\n\n` +
    `Please re-upload this document under the new template via /pcs/admin/imports. The current row will remain in the corpus until the new upload lands; both will be linked via a soft-merge action once the new upload is verified.`;

  const reqPage = await createRequest({
    request: reqText,
    status: 'Open with research',
    requestNotes: reqNotes,
    requestType: 'Replace document',
    requestedBy: auth.user?.email || 'system',
  });

  return NextResponse.json({ ok: true, request: reqPage });
}

/**
 * POST /api/pcs/aics/import
 * Capability: aics.documents:create
 *
 * Accepts a multipart/form-data PDF upload and uses Claude to extract
 * AICS document structure from it. Returns a preview object the client
 * can review and confirm via POST /api/pcs/aics/batch.
 *
 * Form fields:
 *   file — PDF file (required)
 *
 * Returns: { ok: true, doc: {...}, warnings: string[] }
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { extractFromAicsDossier } from '@/lib/aics-dossier-import';

export const dynamic = 'force-dynamic';

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request) {
  const auth = await requireCapability(request, 'aics.documents:create', {
    route: '/api/pcs/aics/import',
  });
  if (auth.error) return auth.error;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const contentType = file.type || '';
  if (!contentType.includes('pdf')) {
    return NextResponse.json(
      { error: `Only PDF files are supported for AICS extraction. Received: ${contentType || 'unknown'}` },
      { status: 400 },
    );
  }

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_PDF_SIZE_BYTES) {
    return NextResponse.json(
      { error: `PDF too large (${Math.round(buf.byteLength / 1024 / 1024)}MB). Maximum is 20MB.` },
      { status: 400 },
    );
  }

  try {
    const { doc, warnings } = await extractFromAicsDossier(buf, file.name || 'aics-dossier.pdf');
    return NextResponse.json({ ok: true, doc, warnings });
  } catch (err) {
    console.error('[aics/import] extraction failed:', err?.message || err);
    return NextResponse.json(
      { error: `Extraction failed: ${err?.message || 'Unknown error'}` },
      { status: 500 },
    );
  }
}

/**
 * POST /api/pcs/evidence/[id]/pdf-upload
 *
 * Manual PDF upload for an Evidence row. Use when the 7-tier retrieval
 * waterfall (src/lib/pmc.js findAndFetchPdf) couldn't reach the PDF —
 * paywalled articles, EndNote-only sources, photocopied scans, etc.
 *
 * Receives a multipart/form-data body with a single `file` field,
 * validates it's a PDF ≤ 50 MB, uploads to Vercel Blob under the same
 * `evidence-pdfs/` prefix the waterfall uses (so URLs are
 * interchangeable), and sets the Evidence row's `pdf` property to the
 * resulting Blob URL via updateEvidence.
 *
 * Capability gate: pcs.evidence:attach (same as POST /api/pcs/evidence).
 *
 * NOTE — Vercel free-tier body limit:
 *   This route accepts the upload server-side, which means the request
 *   body passes through the function. Vercel's default request body
 *   cap is 4.5 MB on the free tier. Operators uploading PDFs larger
 *   than that will get a 413 from the platform before this handler
 *   runs. If we start seeing scanned books or large supplementary PDFs
 *   in the wild, migrate to the client-upload flow with
 *   `@vercel/blob/client` (handleUpload) so the file goes browser →
 *   Blob directly and only a tiny token request hits this function.
 *   For v1 the 50 MB internal cap matches pmc.js for forward
 *   compatibility once we move to client-upload.
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob';
import { requireCapability } from '@/lib/auth/require-capability';
import { getEvidence, updateEvidence } from '@/lib/pcs-evidence';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB, matching pmc.js

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.evidence:attach', {
    route: '/api/pcs/evidence/[id]/pdf-upload',
  });
  if (auth.error) return auth.error;

  const { id } = await params;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: `Expected application/pdf, got ${file.type || 'unknown'}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 50 MB)` },
      { status: 413 },
    );
  }

  // Filename seed: prefer DOI/PMID for traceability, fall back to row id.
  let seed = id;
  try {
    const entry = await getEvidence(id);
    seed = entry?.doi || entry?.pmid || id;
  } catch {
    // Row lookup is informational only — proceed with id seed.
  }
  const safeName = `${String(seed).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}-manual.pdf`;

  let blob;
  try {
    blob = await put(`evidence-pdfs/${safeName}`, file, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });
  } catch (err) {
    console.error('[pdf-upload] blob put failed:', err);
    return NextResponse.json({ error: 'Blob upload failed' }, { status: 502 });
  }

  try {
    await updateEvidence(id, { pdf: blob.url });
  } catch (err) {
    console.error('[pdf-upload] updateEvidence failed:', err);
    return NextResponse.json(
      { error: 'PDF uploaded but Notion update failed' },
      { status: 500 },
    );
  }

  revalidatePath('/api/pcs/evidence');
  revalidatePath(`/api/pcs/evidence/${id}`);

  return NextResponse.json(
    { pdfUrl: blob.url, size: file.size, filename: safeName },
    { status: 201 },
  );
}

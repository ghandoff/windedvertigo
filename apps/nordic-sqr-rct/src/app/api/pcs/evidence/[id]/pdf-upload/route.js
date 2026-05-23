/**
 * POST /api/pcs/evidence/[id]/pdf-upload
 *
 * Manual PDF upload for an Evidence row. Use when the 7-tier retrieval
 * waterfall (src/lib/pmc.js findAndFetchPdf) couldn't reach the PDF —
 * paywalled articles, EndNote-only sources, photocopied scans, etc.
 *
 * Receives a multipart/form-data body with a single `file` field,
 * validates it's a PDF ≤ 50 MB, uploads to R2 (NORDIC_ASSETS binding)
 * under the same `evidence-pdfs/` prefix the waterfall uses, and sets
 * the Evidence row's `pdf` property to the resulting URL via updateEvidence.
 *
 * Storage: R2 bucket NORDIC_ASSETS (wrangler.jsonc). Falls back to
 * Vercel Blob in local dev without a wrangler binding (with a console.warn).
 *
 * On CF Workers the request body limit is 100 MB (vs Vercel's 4.5 MB),
 * so accepting the upload server-side is fine for any practical PDF size.
 *
 * Capability gate: pcs.evidence:attach (same as POST /api/pcs/evidence).
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
// R2 migration complete (2026-05-07): PDF uploads land in Cloudflare R2 via
// `bucket.put` below. The previous @vercel/blob fallback was removed in
// Phase G-2 (2026-05-23) — @vercel/blob is no longer a dependency.
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireCapability } from '@/lib/auth/require-capability';
import { getEvidence, updateEvidence } from '@/lib/pcs-evidence';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB, matching pmc.js
const NORDIC_URL = 'https://nordic.windedvertigo.com';

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
  const key = `evidence-pdfs/${safeName}`;

  let pdfUrl;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.NORDIC_ASSETS;

    if (!bucket) {
      throw new Error('NORDIC_ASSETS R2 binding required (Vercel Blob fallback removed post-migration)');
    }
    await bucket.put(key, file, {
      httpMetadata: { contentType: 'application/pdf' },
    });
    pdfUrl = `${NORDIC_URL}/api/r2/${key}`;
  } catch (err) {
    console.error('[pdf-upload] upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
  }

  try {
    await updateEvidence(id, { pdf: pdfUrl });
  } catch (err) {
    console.error('[pdf-upload] updateEvidence failed:', err);
    return NextResponse.json(
      { error: 'PDF uploaded but evidence update failed' },
      { status: 500 },
    );
  }

  revalidatePath('/api/pcs/evidence');
  revalidatePath(`/api/pcs/evidence/${id}`);

  return NextResponse.json(
    { pdfUrl, size: file.size, filename: safeName },
    { status: 201 },
  );
}

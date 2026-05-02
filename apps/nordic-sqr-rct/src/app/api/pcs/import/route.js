import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { extractFromPdf } from '@/lib/pcs-pdf-import';
import { put } from '@vercel/blob';

// Fluid Compute (Node runtime) — Anthropic SDK streaming can exceed 60s on
// large PCS PDFs. Without these the default 300s cap kicks in and the UI
// shows a cryptic "Extraction failed" when Vercel terminates.
export const runtime = 'nodejs';
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

/**
 * POST /api/pcs/import — Upload a PCS PDF and extract structured data via Claude.
 *
 * Accepts multipart/form-data with a single PDF file.
 * Returns the extracted data for review (does NOT commit to Notion yet).
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/pcs/import' });
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // 20 MB limit for PCS documents
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
    }

    const filename = file.name || 'pcs-upload.pdf';

    // Store PDF in Vercel Blob for reference.
    // SECURITY TODO: @vercel/blob 2.3.x still rejects access:'private' at
    // runtime despite Vercel's public-beta docs. URLs are unguessable
    // (random suffix) but technically public. Revisit when private API
    // stabilizes; source-of-truth PDFs live in Google Drive.
    let blobUrl = null;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`pcs-imports/${filename}`, file, {
        access: 'public',
        addRandomSuffix: true,
      });
      blobUrl = blob.url;
    }

    // Extract structured data from PDF via Claude
    const buffer = await file.arrayBuffer();
    const extracted = await extractFromPdf(buffer, filename);

    return NextResponse.json({
      filename,
      blobUrl,
      extracted,
      warnings: extracted?.warnings || [],
      extractedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('PCS import extraction error:', error);
    return NextResponse.json(
      { error: error.message || 'Extraction failed' },
      { status: 500 }
    );
  }
}

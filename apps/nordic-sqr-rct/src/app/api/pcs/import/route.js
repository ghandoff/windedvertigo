import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireCapability } from '@/lib/auth/require-capability';
import { extractFromPdf } from '@/lib/pcs-pdf-import';

// runtime = 'nodejs' removed — CF Workers/OpenNext requires edge-compatible routes.
export const dynamic = 'force-dynamic';

const NORDIC_URL = 'https://nordic.windedvertigo.com';

/**
 * POST /api/pcs/import — Upload a PCS PDF and extract structured data via Claude.
 *
 * Accepts multipart/form-data with a single PDF file.
 * Returns the extracted data for review (does NOT commit to Notion yet).
 * Storage: R2 bucket NORDIC_ASSETS (optional — extraction proceeds even if
 * R2 is unavailable; blobUrl will be null in that case).
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
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const key = `pcs-imports/${uuid}-${safeFilename}`;

    // Store PDF in R2 for reference (optional — extraction proceeds either way).
    let blobUrl = null;
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bucket = env.NORDIC_ASSETS;
      if (bucket) {
        await bucket.put(key, file, {
          httpMetadata: { contentType: 'application/pdf' },
        });
        blobUrl = `${NORDIC_URL}/api/r2/${key}`;
      }
    } catch {
      // R2 unavailable — proceed with extraction only
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

/**
 * POST /api/admin/imports/upload
 *
 * Server-proxied upload for PCS import files (PDF + DOCX). Replaces the
 * Vercel Blob token-based client-upload flow (upload-token → XHR PUT to
 * blob.vercel-storage.com) with a direct multipart upload to this endpoint
 * that streams the file to R2.
 *
 * Why the change: Vercel Blob's client-token mechanism is tied to
 * BLOB_READ_WRITE_TOKEN and the Vercel Blob infrastructure. On CF Workers,
 * the R2 binding (NORDIC_ASSETS) is the canonical storage. CF Workers also
 * allows 100 MB request bodies (vs Vercel's 4.5 MB), so server-proxied
 * uploads are safe for any realistic import file size.
 *
 * Request: multipart/form-data with a single `file` field.
 *
 * Response: { url, pathname, filename, size }
 *   url      — absolute URL for the uploaded file (/api/r2/pcs-imports/...)
 *   pathname — R2 key (pcs-imports/<uuid>-<filename>)
 *   filename — original filename
 *   size     — bytes uploaded
 *
 * Capability gate: pcs.imports:run (same as the register endpoint).
 *
 * The returned `url` is publicly accessible via GET /api/r2/[...path]
 * (pcs-imports/* is exempt from auth so the extraction cron can fetch it).
 */

import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireCapability } from '@/lib/auth/require-capability';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — same limit as the old token flow

const NORDIC_URL = 'https://nordic.windedvertigo.com';

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', {
    route: '/api/admin/imports/upload',
  });
  if (auth.error) return auth.error;

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
  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type || 'unknown'}. Expected PDF or DOCX.` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 20 MB)` },
      { status: 413 },
    );
  }

  // UUID prefix ensures uniqueness even if the same filename is uploaded twice.
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const pathname = `pcs-imports/${uuid}-${safeFilename}`;

  let url;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.NORDIC_ASSETS;

    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 storage not configured (NORDIC_ASSETS binding missing)' },
        { status: 503 },
      );
    }

    await bucket.put(pathname, file, {
      httpMetadata: { contentType: file.type },
    });
    url = `${NORDIC_URL}/api/r2/${pathname}`;
  } catch (err) {
    console.error('[imports/upload] R2 put failed:', err);
    return NextResponse.json({ error: 'Upload to R2 failed' }, { status: 502 });
  }

  return NextResponse.json({ url, pathname, filename: file.name, size: file.size });
}

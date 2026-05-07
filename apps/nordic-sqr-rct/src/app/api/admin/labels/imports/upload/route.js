/**
 * POST /api/admin/labels/imports/upload
 *
 * Server-proxied upload for label import files (PNG/JPEG/WEBP/GIF/PDF).
 * Replaces the Vercel Blob token-based client-upload flow
 * (labels/imports/upload-token → XHR PUT to blob.vercel-storage.com).
 *
 * Mirrors /api/admin/imports/upload but is scoped to label-imports/* and
 * the labels:upload capability gate.
 *
 * Request: multipart/form-data with a single `file` field.
 * Response: { url, pathname, filename, size }
 */

import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireCapability } from '@/lib/auth/require-capability';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — same limit as the old token flow

const NORDIC_URL = 'https://nordic.windedvertigo.com';

export async function POST(request) {
  const auth = await requireCapability(request, 'labels:upload', {
    route: '/api/admin/labels/imports/upload',
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
      { error: `File type not allowed: ${file.type || 'unknown'}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 20 MB)` },
      { status: 413 },
    );
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const pathname = `label-imports/${uuid}-${safeFilename}`;

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
    console.error('[labels/imports/upload] R2 put failed:', err);
    return NextResponse.json({ error: 'Upload to R2 failed' }, { status: 502 });
  }

  return NextResponse.json({ url, pathname, filename: file.name, size: file.size });
}

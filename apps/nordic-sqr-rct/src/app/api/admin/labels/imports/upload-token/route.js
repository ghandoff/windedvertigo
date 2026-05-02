import { NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { requireCapability } from '@/lib/auth/require-capability';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/labels/imports/upload-token
 *
 * Wave 5.3 counterpart to /api/admin/imports/upload-token. Issues a short-lived,
 * pathname-scoped client token so the browser can PUT a label image directly
 * to Vercel Blob. Pathname must begin with "label-imports/". Content types
 * restricted to PNG/JPEG/WEBP/GIF/PDF (PDF supported for intake even though
 * extraction currently requires an image — operators can convert later).
 *
 * Mirrors the Wave 3.6 raw-XHR pattern: we do NOT call @vercel/blob/client's
 * put()/upload() from the browser because they hang in our Turbopack bundle.
 * See src/app/pcs/admin/imports/page.js for the uploadViaXhr() helper.
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports/upload-token' });
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid JSON body', message: err?.message || String(err) },
      { status: 400 },
    );
  }

  const { pathname } = body || {};
  if (!pathname || typeof pathname !== 'string' || !pathname.startsWith('label-imports/')) {
    return NextResponse.json(
      { error: 'pathname required; must start with "label-imports/"' },
      { status: 400 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Blob storage not configured (BLOB_READ_WRITE_TOKEN missing)' },
      { status: 500 },
    );
  }

  try {
    const token = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname,
      allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'],
      maximumSizeInBytes: 20 * 1024 * 1024,
      validUntil: Date.now() + 5 * 60_000,
      addRandomSuffix: true,
    });
    return NextResponse.json({ token, pathname });
  } catch (err) {
    console.error('labels/upload-token: failed to generate client token', err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

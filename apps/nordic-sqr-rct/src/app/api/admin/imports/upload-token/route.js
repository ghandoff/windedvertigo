import { NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { requireCapability } from '@/lib/auth/require-capability';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/upload-token
 *
 * Issues a short-lived, pathname-scoped client token for direct-to-Blob
 * client uploads. The browser uses this token with @vercel/blob/client's
 * low-level `put()` to PUT file bytes directly to Vercel Blob storage
 * without going through a Vercel Function.
 *
 * This replaces the prior `handleUpload()` implementation that relied on
 * a post-upload webhook callback from Vercel Blob's infrastructure —
 * that callback repeatedly fought with our auth middleware and CSP, and
 * the client's upload() promise would hang waiting for a server ACK that
 * never came. The new flow issues the token synchronously and uses
 * `put()` on the client which completes as soon as Blob returns 200 —
 * no callback ceremony.
 *
 * Request body:
 *   { pathname: string }   — must start with "pcs-imports/"
 *
 * Response:
 *   { token: string, pathname: string }
 *
 * Enforces (server-side in the token payload):
 *   - content type must be application/pdf OR
 *     application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *     (Wave 3.8 — Word .docx accepted alongside PDF)
 *   - size must be <= 20 MB
 *   - token valid for 5 minutes from issuance
 *   - random suffix on filename (prevents collisions)
 */

// Wave 3.8 — PCS imports now accept either a PDF or a Word .docx. The two
// allowed MIME types are enumerated here so the Blob upload server-side token
// rejects anything else (e.g. legacy .doc, images, arbitrary uploads).
const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports/upload-token' });
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
  if (!pathname || typeof pathname !== 'string' || !pathname.startsWith('pcs-imports/')) {
    return NextResponse.json(
      { error: 'pathname required; must start with "pcs-imports/"' },
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
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
      maximumSizeInBytes: 20 * 1024 * 1024,
      validUntil: Date.now() + 5 * 60_000, // 5 minute window
      addRandomSuffix: true,
    });
    return NextResponse.json({ token, pathname });
  } catch (err) {
    console.error('upload-token: failed to generate client token', err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

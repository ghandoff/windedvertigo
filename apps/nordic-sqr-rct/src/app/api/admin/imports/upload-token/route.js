import { NextResponse } from 'next/server';

// runtime = 'nodejs' removed — CF Workers/OpenNext requires edge-compatible routes.
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/upload-token — REMOVED (Wave 8 / R2 migration)
 *
 * This endpoint issued short-lived Vercel Blob client tokens for direct
 * browser-to-Blob uploads. Replaced by POST /api/admin/imports/upload,
 * which accepts multipart/form-data and streams directly to R2.
 *
 * The old two-step flow (upload-token → XHR PUT to blob.vercel-storage.com)
 * is no longer used by ImportsPanel.js.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint has been removed. Use POST /api/admin/imports/upload (multipart/form-data) instead.',
      replacement: 'POST /api/admin/imports/upload',
    },
    { status: 410 },
  );
}

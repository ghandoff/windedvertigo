import { NextResponse } from 'next/server';

// runtime = 'nodejs' removed — CF Workers/OpenNext requires edge-compatible routes.
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/labels/imports/upload-token — REMOVED (Wave 8 / R2 migration)
 *
 * This endpoint issued short-lived Vercel Blob client tokens for direct
 * browser-to-Blob uploads of label files. Replaced by
 * POST /api/admin/labels/imports/upload, which accepts multipart/form-data
 * and streams directly to R2.
 *
 * The old two-step flow is no longer used by LabelsImportsPanel.js.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint has been removed. Use POST /api/admin/labels/imports/upload (multipart/form-data) instead.',
      replacement: 'POST /api/admin/labels/imports/upload',
    },
    { status: 410 },
  );
}

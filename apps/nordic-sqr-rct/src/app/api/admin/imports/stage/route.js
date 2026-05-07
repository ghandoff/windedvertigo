import { NextResponse } from 'next/server';

// runtime = 'nodejs' removed — CF Workers/OpenNext requires edge-compatible routes.
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/stage — REMOVED (Wave 8)
 *
 * This endpoint was deprecated in Wave 4 (2026-04-21) when the Data Hub
 * switched to the two-step direct-upload flow:
 *   POST /api/admin/imports/upload  (upload file → R2)
 *   POST /api/admin/imports/register (page-count + create job)
 *
 * The old stage route combined both steps in one server-side request,
 * which caused 504 timeouts with multi-PDF batches. The new split flow
 * uploads files in parallel via XHR (with progress indicators) then
 * registers them in a single lightweight JSON call.
 *
 * Any client still calling this endpoint should be updated to use the
 * new two-step flow above.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint has been removed. Use POST /api/admin/imports/upload then POST /api/admin/imports/register.',
      migration: {
        step1: 'POST /api/admin/imports/upload (multipart/form-data, file field)',
        step2: 'POST /api/admin/imports/register ({ uploads: [{ url, filename, size, contentHash }] })',
      },
    },
    { status: 410 },
  );
}

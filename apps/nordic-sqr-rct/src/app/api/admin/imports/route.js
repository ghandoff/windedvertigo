import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllJobs,
  getJobsByStatus,
  getJobsByBatch,
} from '@/lib/pcs-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/imports
 *
 * Query params:
 *   status  — filter by job status (optional)
 *   batchId — filter by batch (optional)
 *   limit   — cap on results (default 100)
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const batchId = searchParams.get('batchId');
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : 100;

  try {
    let jobs;
    if (batchId) {
      jobs = await getJobsByBatch(batchId);
    } else if (status) {
      jobs = await getJobsByStatus(status, limit);
    } else {
      jobs = await getAllJobs();
      jobs = jobs.slice(0, limit);
    }
    // Strip the (possibly large) extractedData from list responses to keep
    // the dashboard payload small. Detail endpoint returns the full row.
    const stripped = jobs.map(j => ({ ...j, extractedData: j.extractedData ? `[${j.extractedData.length} chars]` : '' }));
    return NextResponse.json({ jobs: stripped });
  } catch (err) {
    console.error('List imports failed:', err);
    return NextResponse.json(
      { error: 'List failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

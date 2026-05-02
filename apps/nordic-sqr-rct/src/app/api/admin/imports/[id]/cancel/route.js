import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getJob, updateJob } from '@/lib/pcs-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/[id]/cancel
 *
 * Marks a queued job as skipped so the worker won't pick it up. Safe at any
 * time but typically used on 'queued' rows before extraction starts.
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.imports:cancel', { route: '/api/admin/imports/[id]/cancel' });
  if (auth.error) return auth.error;
  const user = auth.user;

  const { id } = await params;
  try {
    const job = await getJob(id);
    if (job.status === 'committed') {
      return NextResponse.json(
        { error: 'Cannot cancel — job already committed.' },
        { status: 409 },
      );
    }
    const updated = await updateJob(id, {
      status: 'skipped',
      error: `Cancelled by ${user.email || 'admin'} at ${new Date().toISOString()}`,
    });
    return NextResponse.json({ ok: true, job: { ...updated, extractedData: updated.extractedData ? `[${updated.extractedData.length} chars]` : '' } });
  } catch (err) {
    console.error('Cancel failed:', err);
    return NextResponse.json(
      { error: 'Cancel failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

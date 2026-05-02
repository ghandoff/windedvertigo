import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getJob, updateJob } from '@/lib/pcs-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/[id]/retry
 *
 * Resets a failed job to the earliest phase it can resume from and clears
 * its retryCount + error. Already-committed jobs are refused (user should
 * create a new import instead of re-committing).
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports/[id]/retry' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const job = await getJob(id);
    if (job.createdDocumentId) {
      return NextResponse.json(
        { error: 'Already committed — cannot retry a completed job. Create a new import instead.' },
        { status: 409 },
      );
    }
    const resumeStatus = job.extractedData && job.extractedData.length > 10 ? 'extracted' : 'queued';
    const updated = await updateJob(id, {
      status: resumeStatus,
      retryCount: 0,
      error: '',
    });
    return NextResponse.json({ ok: true, job: { ...updated, extractedData: updated.extractedData ? `[${updated.extractedData.length} chars]` : '' } });
  } catch (err) {
    console.error('Retry failed:', err);
    return NextResponse.json(
      { error: 'Retry failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

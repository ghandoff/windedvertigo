import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getJob, createJob } from '@/lib/pcs-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/bulk-reextract
 *
 * Body: { jobIds: string[] }
 *
 * For each source job that has already been committed, creates a NEW job
 * pointing at the same PDF blob + PCS ID, with conflictAction='link' and
 * existingDocId set to the source's createdDocumentId. This is how operators
 * re-run extraction under an updated prompt without discarding prior commits.
 *
 * Jobs that are not in the 'committed' state are skipped and reported back.
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports/bulk-reextract' });
  if (auth.error) return auth.error;
  const user = auth.user;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid JSON body', message: err?.message || String(err) },
      { status: 400 },
    );
  }

  const jobIds = Array.isArray(body?.jobIds) ? body.jobIds.filter(x => typeof x === 'string' && x) : [];
  if (jobIds.length === 0) {
    return NextResponse.json({ error: 'jobIds (non-empty array) is required' }, { status: 400 });
  }

  const newBatchId = 'reextract-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const newJobIds = [];
  const skipped = [];

  for (const id of jobIds) {
    let source;
    try {
      source = await getJob(id);
    } catch (err) {
      skipped.push({ id, reason: `failed to fetch source: ${err?.message || err}` });
      continue;
    }
    if (source.status !== 'committed') {
      skipped.push({ id, jobId: source.jobId, reason: `source status is '${source.status}', expected 'committed'` });
      continue;
    }
    if (!source.pdfUrl) {
      skipped.push({ id, jobId: source.jobId, reason: 'source has no pdfUrl' });
      continue;
    }
    try {
      const created = await createJob({
        pdfUrl: source.pdfUrl,
        pdfFilename: source.pdfFilename,
        pcsId: source.pcsId || null,
        conflictAction: 'link',
        existingDocId: source.createdDocumentId || null,
        batchId: newBatchId,
        ownerEmail: source.ownerEmail || user.email || null,
        initialStatus: 'queued',
        contentHash: source.contentHash || null,
      });
      newJobIds.push({ id: created.id, jobId: created.jobId, sourceJobId: source.jobId });
    } catch (err) {
      skipped.push({ id, jobId: source.jobId, reason: `createJob failed: ${err?.message || err}` });
    }
  }

  return NextResponse.json({ newBatchId, newJobIds, skipped });
}

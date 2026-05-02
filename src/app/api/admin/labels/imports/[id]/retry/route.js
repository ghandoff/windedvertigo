import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIntakeRow, updateIntakeRow } from '@/lib/label-intake-queue';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/labels/imports/[id]/retry
 *
 * Re-queue a label intake row for extraction. Resets status to Pending,
 * clears the error string, zeros retryCount, and clears extractionData so
 * the next cron tick picks it up fresh. Intended for:
 *   - Failed rows (after the underlying code bug is fixed)
 *   - Needs Validation rows where the extraction was poor enough that
 *     re-running is easier than hand-correcting.
 *
 * Refuses to re-queue Committed rows (that's what cancel→re-stage is for).
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports/[id]/retry' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const row = await getIntakeRow(id);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (row.status === 'Committed') {
      return NextResponse.json(
        { error: 'Cannot retry a Committed row — cancel and re-stage instead.' },
        { status: 409 },
      );
    }
    await updateIntakeRow(id, {
      status: 'Pending',
      error: '',
      retryCount: 0,
      extractionData: '',
      confidenceOverall: null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Retry label intake row failed:', err);
    return NextResponse.json(
      { error: 'Retry failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}

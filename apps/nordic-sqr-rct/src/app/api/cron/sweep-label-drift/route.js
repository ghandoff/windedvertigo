import { NextResponse } from 'next/server';
import { detectDriftForAllActiveLabels } from '@/lib/label-drift';

export const runtime = 'nodejs';
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sweep-label-drift
 *
 * Wave 5.2 nightly sweep: re-check Active labels with Last Drift Check > 90
 * days (or null). Batches at most 10 labels per tick to stay under the
 * function timeout — each label makes one LLM call per label-claim.
 *
 * Auth: CRON_SECRET bearer token (mirror process-label-imports).
 * Schedule: 0 8 * * * (daily 8am UTC = 1am Pacific).
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const stats = await detectDriftForAllActiveLabels({
      limit: 10,
      staleDays: 90,
      deadlineMs: start + 780_000,
      log: (line) => console.log('[cron:sweep-label-drift]', line),
    });
    return NextResponse.json({ ok: true, durationMs: Date.now() - start, ...stats });
  } catch (err) {
    console.error('[cron:sweep-label-drift] fatal:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

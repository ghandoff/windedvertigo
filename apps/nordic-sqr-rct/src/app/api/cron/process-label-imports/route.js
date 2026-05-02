import { NextResponse } from 'next/server';
import { runLabelBatch } from '@/lib/label-import-runner';

export const runtime = 'nodejs';
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/process-label-imports
 *
 * Vercel Cron entry point for the Wave 5.3 label import worker. Authenticated
 * via CRON_SECRET. Picks up Label Intake Queue rows in Pending state, runs
 * Claude Vision extraction, creates Product Labels rows, and advances the
 * intake row to Committed / Needs Validation / Failed.
 *
 * Schedule: every 5 minutes (see vercel.json crons array).
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const stats = await runLabelBatch({
      limit: 3,
      deadlineMs: start + 780_000,
      log: (line) => console.log('[cron:process-label-imports]', line),
    });
    return NextResponse.json({ ok: true, durationMs: Date.now() - start, ...stats });
  } catch (err) {
    console.error('[cron:process-label-imports] fatal:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

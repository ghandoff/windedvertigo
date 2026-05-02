import { NextResponse } from 'next/server';
import { runBatch } from '@/lib/pcs-import-runner';

export const runtime = 'nodejs';
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/process-imports
 *
 * Vercel Cron entry point for the PCS import worker. Authenticated via
 * the CRON_SECRET bearer token that Vercel injects on cron requests.
 *
 * Runs one batch tick (sweep stale, extract up to 3, commit up to 3) with
 * a 13-minute wall-clock budget so the function returns cleanly before
 * Vercel's 15-minute cron ceiling.
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const stats = await runBatch({
      limit: 3,
      deadlineMs: start + 780_000,
      log: (line) => console.log('[cron:process-imports]', line),
    });
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      ...stats,
    });
  } catch (err) {
    console.error('[cron:process-imports] fatal:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

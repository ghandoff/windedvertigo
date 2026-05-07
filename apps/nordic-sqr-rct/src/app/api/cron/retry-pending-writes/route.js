import { NextResponse } from 'next/server';
import { getPcsSupabase, mirrorToPostgres } from '@/lib/supabase-pcs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/retry-pending-writes
 *
 * Path-2 Phase B Bundle 1 — drains the strong-consistency retry
 * queue. When `PCS_STRONG_CONSISTENCY=1` is on and a Notion-write
 * succeeded but the Postgres mirror failed, the row was enqueued
 * to `pcs_pending_writes`. This cron picks them up and re-attempts
 * the mirror.
 *
 * Selects up to 50 unresolved rows (succeeded_at IS NULL AND
 * attempts < 10) ordered by enqueued_at ASC. Per row:
 *   - Re-runs `mirrorToPostgres` with the saved payload + columnMap.
 *   - On success: stamps `succeeded_at = NOW()` (kept for audit).
 *   - On failure: bumps `attempts`, updates last_attempt_at + last_error.
 *
 * Rows with attempts >= 10 are skipped — that's the manual-review
 * threshold (something is structurally wrong with that payload).
 *
 * Authenticated via CRON_SECRET bearer token.
 *
 * Schedule: every 3 minutes (offset from drift-sync's every-2-min
 * so we don't compete for worker quota at the top of the minute).
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getPcsSupabase();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  const start = Date.now();

  const { data: pending, error: selErr } = await sb
    .from('pcs_pending_writes')
    .select('id, pg_table, notion_page_id, payload, attempts')
    .is('succeeded_at', null)
    .lt('attempts', 10)
    .order('enqueued_at', { ascending: true })
    .limit(50);

  if (selErr) {
    console.error('[cron:retry-pending-writes] select failed:', selErr.message);
    return NextResponse.json(
      { ok: false, error: selErr.message },
      { status: 500 },
    );
  }

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const row of pending || []) {
    attempted++;
    const payload = row.payload || {};
    const parsedRow = payload.row;
    const columnMap = payload.columnMap || {};
    if (!parsedRow) {
      failed++;
      await sb
        .from('pcs_pending_writes')
        .update({
          attempts: (row.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: 'malformed payload (missing row)',
        })
        .eq('id', row.id);
      continue;
    }
    // Re-attempt the mirror. Don't re-enqueue on failure — we're
    // already working from the queue; just bump attempts.
    const result = await mirrorToPostgres(row.pg_table, parsedRow, columnMap);
    if (result.mirrored) {
      succeeded++;
      const { error: updErr } = await sb
        .from('pcs_pending_writes')
        .update({
          succeeded_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id);
      if (updErr) {
        console.warn(
          `[cron:retry-pending-writes] success-stamp failed for ${row.id}: ${updErr.message}`,
        );
      }
    } else {
      failed++;
      await sb
        .from('pcs_pending_writes')
        .update({
          attempts: (row.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: result.reason || 'unknown',
        })
        .eq('id', row.id);
    }
  }

  // Count rows that hit the permanent-fail threshold (attempts >= 10
  // AND still unresolved). Surfaced in the log + response so admin
  // dashboards can flag manual-review backlog.
  const { count: permanentlyFailed } = await sb
    .from('pcs_pending_writes')
    .select('*', { count: 'exact', head: true })
    .is('succeeded_at', null)
    .gte('attempts', 10);

  console.log(
    `[cron:retry-pending-writes] attempted=${attempted} succeeded=${succeeded} failed=${failed} permanently_failed=${permanentlyFailed ?? 0}`,
  );

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    attempted,
    succeeded,
    failed,
    permanentlyFailed: permanentlyFailed ?? 0,
  });
}

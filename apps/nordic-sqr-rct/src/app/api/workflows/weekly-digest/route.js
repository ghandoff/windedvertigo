import { NextResponse } from 'next/server';
import { start, getRun } from 'workflow/api';
import { weeklyDigestWorkflow } from '@/workflows/weekly-digest';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Wave 4.5.2 — Trigger endpoint for the weekly digest workflow.
 *
 * GET /api/workflows/weekly-digest
 *   Called by Vercel Cron on the schedule defined in `vercel.json`
 *   (Mondays at 16:00 UTC = 08:00 PT standard time). Gated by the same
 *   CRON_SECRET bearer-token pattern used by /api/cron/process-imports.
 *
 * POST /api/workflows/weekly-digest
 *   Manual invocation for operators (e.g. curl during testing). Same auth.
 *
 * Both methods start() the workflow and return its runId so you can inspect
 * with `npx workflow inspect run <runId>` or the web UI.
 *
 * See docs/runbooks/wave-4.5.2-weekly-digest.md.
 */

async function trigger(request, { waitForCompletion = false } = {}) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const run = await start(weeklyDigestWorkflow);
    console.log('[weekly-digest] started runId=%s', run.runId);

    if (!waitForCompletion) {
      return NextResponse.json({ ok: true, runId: run.runId });
    }

    // Optional synchronous path (handy for ad-hoc manual triggers).
    const finished = getRun(run.runId);
    const result = await finished.returnValue;
    return NextResponse.json({ ok: true, runId: run.runId, result });
  } catch (err) {
    console.error('[weekly-digest] trigger failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  return trigger(request);
}

export async function POST(request) {
  const url = new URL(request.url);
  const wait = url.searchParams.get('wait') === '1';
  return trigger(request, { waitForCompletion: wait });
}

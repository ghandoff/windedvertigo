import { NextResponse } from 'next/server';
import { nightlyRepingWorkflow } from '@/workflows/nightly-reping';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Wave 4.5.3 — Trigger endpoint for the nightly re-ping workflow.
 *
 * GET /api/workflows/nightly-reping
 *   Called by Vercel Cron on the schedule in `vercel.json` (0 7 * * * UTC =
 *   11pm PT standard / midnight PDT). Gated by the same CRON_SECRET bearer
 *   pattern as /api/workflows/weekly-digest and /api/cron/process-imports.
 *
 * POST /api/workflows/nightly-reping
 *   Manual invocation. Append `?wait=1` for synchronous execution.
 *
 * See docs/runbooks/wave-4.5.3-nightly-reping.md.
 */

async function trigger(request, { waitForCompletion = false } = {}) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await nightlyRepingWorkflow();
    console.log('[nightly-reping] completed', result);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[nightly-reping] trigger failed:', err);
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

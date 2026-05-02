/**
 * Wave 5.4 — Trigger endpoint for the ingredient-safety sweep workflow.
 *
 * POST /api/workflows/ingredient-safety
 *   Manual or automated kickoff. CRON_SECRET-gated. Accepts the
 *   safety-signal input schema (see docs/plans/wave-5-product-labels.md §5).
 *
 *   Body JSON:
 *     {
 *       evidenceId: string,
 *       ingredientId: string,
 *       doseThreshold?: number,
 *       doseUnit?: string,
 *       demographicFilter?: { biologicalSex?, ageGroup?, lifeStage?, lifestyle? },
 *       triggeringUserId?: string,
 *       declaredAt?: ISO8601
 *     }
 *
 *   Query flag: ?wait=1 blocks until the workflow settles (testing only —
 *   real runs fan out for days while waiting on RA resolutions).
 *
 * See docs/runbooks/wave-5.4-ingredient-safety.md.
 */

import { NextResponse } from 'next/server';
import { ingredientSafetySweep } from '@/workflows/ingredient-safety';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function readBody(request) {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.evidenceId || !body.ingredientId) {
    return NextResponse.json(
      { error: 'evidenceId and ingredientId are required' },
      { status: 400 },
    );
  }

  const input = {
    evidenceId: String(body.evidenceId),
    ingredientId: String(body.ingredientId),
    doseThreshold: typeof body.doseThreshold === 'number' ? body.doseThreshold : null,
    doseUnit: body.doseUnit ? String(body.doseUnit) : null,
    demographicFilter: body.demographicFilter && typeof body.demographicFilter === 'object' ? body.demographicFilter : null,
    triggeringUserId: body.triggeringUserId ? String(body.triggeringUserId) : null,
    declaredAt: body.declaredAt ? String(body.declaredAt) : new Date().toISOString(),
  };

  try {
    // Saga pattern: sweep completes quickly (opens requests + inserts pending rows),
    // then resolves asynchronously via POST /api/webhooks/safety/resolve.
    const result = await ingredientSafetySweep(input);
    console.log('[ingredient-safety] sweep initiated evidenceId=%s ingredientId=%s mode=%s',
      input.evidenceId, input.ingredientId, result.mode);
    return NextResponse.json({ ok: true, result }, { status: 202 });
  } catch (err) {
    console.error('[ingredient-safety] trigger failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}

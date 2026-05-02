/**
 * Wave 5.4 — Notion webhook: Evidence row updated.
 *
 * When a Research member checks `Safety signal` on an Evidence row and fills
 * in the structured alert fields (ingredient, dose threshold, dose unit,
 * demographic filter), Notion calls this endpoint. We read the current page
 * state, validate the safety declaration, and fire-and-forget the
 * `ingredientSafetySweep` workflow.
 *
 * Notion webhook setup is MANUAL — documented in
 * docs/runbooks/wave-5.4-ingredient-safety.md. This route handles both the
 * one-time `url_verification` challenge and subsequent `page.updated` events.
 *
 * Safety:
 *   - 30-second route timeout. We start() the workflow (fire-and-forget) and
 *     return 202 immediately — the durable workflow handles its own fan-out.
 *   - A workflow-start failure MUST NOT prevent the Evidence row update from
 *     succeeding from Notion's perspective. We log and return 200 with an
 *     `{ ok: false, reason }` body in that case.
 *   - Dedup: we rely on the workflow's per-request upsert logic. Re-firing
 *     the workflow for the same Evidence × Label combo is a no-op in terms
 *     of Request rows (same specificField = safety-review:evidenceId:labelId).
 *
 * Token: the `NOTION_WEBHOOK_TOKEN` env var is a shared secret that Notion
 * includes as a bearer token on every webhook call. If unset we accept all
 * calls (preview deploys / local dev) but log a warning.
 */

import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { ingredientSafetySweep } from '@/workflows/ingredient-safety';
import { getEvidence } from '@/lib/pcs-evidence';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function parseDemographicFilter(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch {
    console.warn('[evidence-updated] Safety demographic filter is not valid JSON, ignoring:', trimmed.slice(0, 120));
    return null;
  }
}

function verifyAuth(request) {
  const expected = process.env.NOTION_WEBHOOK_TOKEN;
  if (!expected) {
    // Allow-through with warning for Preview / local dev. Production should
    // have NOTION_WEBHOOK_TOKEN set.
    console.warn('[evidence-updated] NOTION_WEBHOOK_TOKEN not set — accepting all calls');
    return true;
  }
  const auth = request.headers.get('authorization') || '';
  const xToken = request.headers.get('x-notion-webhook-token') || '';
  return auth === `Bearer ${expected}` || xToken === expected;
}

export async function POST(request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Notion verification challenge — mirror the token back on first setup.
  if (body?.type === 'url_verification' && body?.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }
  if (body?.verification_token && !body?.type) {
    return NextResponse.json({ ok: true, verification_token: body.verification_token });
  }

  // Accept a variety of Notion webhook payload shapes. We need the page id.
  const pageId =
    body?.entity?.id ||
    body?.data?.parent?.id ||
    body?.page?.id ||
    body?.id ||
    null;

  if (!pageId) {
    // Not a row-level event — nothing to do, but respond ok to avoid Notion
    // retries for non-actionable events.
    return NextResponse.json({ ok: true, reason: 'no page id in payload' });
  }

  try {
    const evidence = await getEvidence(pageId);
    if (!evidence?.safetySignal) {
      return NextResponse.json({ ok: true, reason: 'safety signal not set', pageId });
    }
    if (!evidence.safetyIngredientIds?.length) {
      return NextResponse.json({ ok: true, reason: 'safety ingredient missing', pageId });
    }

    const input = {
      evidenceId: evidence.id,
      ingredientId: evidence.safetyIngredientIds[0],
      doseThreshold: evidence.safetyDoseThreshold ?? null,
      doseUnit: evidence.safetyDoseUnit || null,
      demographicFilter: parseDemographicFilter(evidence.safetyDemographicFilterRaw),
      triggeringUserId: null, // Notion payload typically includes editor id — plumb in a follow-up.
      declaredAt: new Date().toISOString(),
    };

    // Fire-and-forget — workflow handles its own durability.
    try {
      const run = await start(ingredientSafetySweep, [input]);
      console.log('[evidence-updated] started runId=%s evidenceId=%s ingredientId=%s',
        run.runId, input.evidenceId, input.ingredientId);
      return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
    } catch (err) {
      // Workflow-start failure MUST NOT fail the Notion webhook — log and
      // ack so the Evidence update is not held back.
      console.error('[evidence-updated] failed to start workflow:', err);
      return NextResponse.json({ ok: false, reason: 'workflow start failed', error: err?.message || String(err) }, { status: 200 });
    }
  } catch (err) {
    console.error('[evidence-updated] handler error:', err);
    // Still respond 200 so Notion does not retry storm.
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 200 });
  }
}

// GET for simple health/debug.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'notion/evidence-updated' });
}

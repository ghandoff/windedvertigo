/**
 * Wave 5.4 — Ingredient-safety cross-check workflow.
 *
 * Triggered by a human flagging an Evidence row as a safety signal. The
 * workflow finds every Active Product Label that shares the flagged
 * ingredient (with a demographic and dose overlap, when specified), opens
 * one Research Request per matched SKU routed to RA at priority='Safety',
 * posts a single digest to #ra-safety, then records each open request in
 * the `safety_sweep_pending` Supabase table (saga pattern — replaces the
 * previous Workflow DevKit `createHook()` durable-wait).
 *
 * Resolution is now handled by POST /api/webhooks/safety/resolve which marks
 * rows resolved_at and fires the "sweep complete" Slack when all are done.
 */

import { getSafetySupabase } from '@/lib/supabase-safety';
import {
  findLabelsByIngredientDoseAndDemographic,
  openSafetyReviewRequest,
} from '@/lib/label-safety';

const DEFAULT_SITE_URL = 'https://nordic-sqr-rct.vercel.app';

/* -------------------------------------------------------------------------- */
/* Step 1 — enumerate matching labels                                         */
/* -------------------------------------------------------------------------- */

async function enumerateMatches(input) {

  const matches = await findLabelsByIngredientDoseAndDemographic({
    ingredientId: input.ingredientId,
    doseThreshold: input.doseThreshold,
    doseUnit: input.doseUnit,
    demographicFilter: input.demographicFilter,
  });
  console.log(`[ingredient-safety] matched ${matches.length} labels for ingredient=${input.ingredientId}`);
  return matches;
}

/* -------------------------------------------------------------------------- */
/* Step 2 — open one Research Request per matched label                       */
/* -------------------------------------------------------------------------- */

async function openRequestForLabel(input, label) {

  try {
    const res = await openSafetyReviewRequest({
      labelId: label.id,
      evidenceId: input.evidenceId,
      ingredientId: input.ingredientId,
      doseThreshold: input.doseThreshold,
      doseUnit: input.doseUnit,
      triggeringUserId: input.triggeringUserId,
    });
    return { ...res };
  } catch (err) {
    // Best-effort: surface the error in the workflow result but don't crash
    // the run — other labels still deserve a request.
    console.warn(`[ingredient-safety] openRequest failed for label ${label.id}:`, err?.message || err);
    return { action: 'error', id: null, labelId: label.id, sku: label.sku, error: String(err?.message || err) };
  }
}

/* -------------------------------------------------------------------------- */
/* Step 3 — Slack digest to RA channel                                        */
/* -------------------------------------------------------------------------- */

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}

function notionPageUrl(id) {
  return `https://www.notion.so/${String(id || '').replace(/-/g, '')}`;
}

function buildSafetyDigest(requests, input) {
  const created = requests.filter(r => r.action === 'created' || r.action === 'updated');
  const header = `🛡 Safety sweep opened — ingredient \`${input.ingredientId}\` at ≥${input.doseThreshold ?? '?'}${input.doseUnit ? ' ' + input.doseUnit : ''}`;
  const rows = created.map(r => {
    const sku = r.sku || r.labelId?.slice(0, 8) || 'unknown';
    const link = r.id ? `<${notionPageUrl(r.id)}|Request>` : '(no request id)';
    return `• ${sku} — ${link}`;
  }).join('\n') || '_No matching Active labels._';
  const footer = `${created.length} Research Request${created.length === 1 ? '' : 's'} opened · Evidence: <${notionPageUrl(input.evidenceId)}|source>`;
  return { header, rows, footer };
}

async function notifyRaDigest(requests, input) {

  const channelOverride = process.env.SLACK_SAFETY_CHANNEL || process.env.SLACK_REQUESTS_CHANNEL || null;
  const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN);
  const webhook = process.env.SLACK_WEBHOOK_URL;

  const digest = buildSafetyDigest(requests, input);
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '🛡 Safety sweep opened' } },
    { type: 'section', text: { type: 'mrkdwn', text: `${digest.header}\n\n${digest.rows}` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `${digest.footer} · <${siteUrl()}/pcs/requests?filter=all|Dashboard>` }] },
  ];
  const text = `${digest.header} — ${requests.length} labels flagged`;

  // Prefer bot API (can target specific channel) when token is present.
  if (hasBotToken && channelOverride) {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: channelOverride, text, blocks }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      throw new Error(`Slack API error: ${data?.error || resp.status}`);
    }
    return { sent: true, via: 'bot', channel: channelOverride };
  }

  // Fallback: webhook. Lacks channel targeting but gets the digest out.
  if (webhook) {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Slack webhook ${resp.status}: ${body.slice(0, 200)}`);
    }
    return { sent: true, via: 'webhook' };
  }

  return { sent: false, reason: 'no SLACK_BOT_TOKEN+channel and no SLACK_WEBHOOK_URL' };
}

async function notifyComplete(input, totalRequests) {

  const channelOverride = process.env.SLACK_SAFETY_CHANNEL || process.env.SLACK_REQUESTS_CHANNEL || null;
  const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN);
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const text = `✅ Safety sweep for ingredient \`${input.ingredientId}\` complete. ${totalRequests} label${totalRequests === 1 ? '' : 's'} reviewed.`;

  if (hasBotToken && channelOverride) {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: channelOverride, text }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      throw new Error(`Slack API error: ${data?.error || resp.status}`);
    }
    return { sent: true, via: 'bot' };
  }
  if (webhook) {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Slack webhook ${resp.status}: ${body.slice(0, 200)}`);
    }
    return { sent: true, via: 'webhook' };
  }
  return { sent: false, reason: 'no Slack delivery configured' };
}

/* -------------------------------------------------------------------------- */
/* Workflow orchestrator                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ingredient-safety cross-check workflow.
 *
 * @param {object} input
 * @param {string} input.evidenceId
 * @param {string} input.ingredientId
 * @param {number} [input.doseThreshold]
 * @param {string} [input.doseUnit]
 * @param {object} [input.demographicFilter]
 * @param {string} [input.triggeringUserId]
 * @param {string} [input.declaredAt]  ISO8601
 */
export async function ingredientSafetySweep(input) {

  if (!input || !input.evidenceId || !input.ingredientId) {
    return { ok: false, reason: 'missing evidenceId or ingredientId' };
  }

  // Step 1: enumerate matches.
  const matches = await enumerateMatches(input);
  if (!matches.length) {
    await notifyRaDigest([], input);
    return { ok: true, mode: 'noop', reason: 'no matching labels', matches: 0 };
  }

  // Step 2: open one Request per label, sequentially so Notion doesn't get hammered.
  const requests = [];
  for (const label of matches) {
    const res = await openRequestForLabel(input, label);
    requests.push(res);
  }

  // Step 3: single digest to #ra-safety.
  await notifyRaDigest(requests, input);

  // Step 4 (saga): record each open request in safety_sweep_pending.
  // Resolution is now async — POST /api/webhooks/safety/resolve marks rows
  // resolved_at and fires notifyComplete when all rows for the run are done.
  const resolvable = requests.filter(r => r.id && (r.action === 'created' || r.action === 'updated'));
  if (resolvable.length > 0) {
    const runId = `${input.evidenceId}:${Date.now()}`;
    const sb = getSafetySupabase();
    if (sb) {
      const rows = resolvable.map(r => ({
        run_id: runId,
        evidence_id: input.evidenceId,
        ingredient_id: input.ingredientId,
        request_id: r.id,
        sku: r.sku || null,
      }));
      const { error } = await sb.from('safety_sweep_pending').upsert(rows, { onConflict: 'run_id,request_id' });
      if (error) {
        console.warn('[ingredient-safety] failed to insert safety_sweep_pending rows:', error.message);
      } else {
        console.log(`[ingredient-safety] saga: inserted ${rows.length} pending rows for runId=${runId}`);
      }
    } else {
      console.warn('[ingredient-safety] SUPABASE_NORDIC_URL not configured — saga rows skipped');
    }
  }

  return {
    ok: true,
    mode: 'saga',
    matches: matches.length,
    requestsOpened: resolvable.length,
    requests: requests.map(r => ({ action: r.action, id: r.id, sku: r.sku, labelId: r.labelId })),
  };
}

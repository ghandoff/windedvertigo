/**
 * Wave 5.4 — Ingredient-safety cross-check workflow.
 *
 * Triggered by a human flagging an Evidence row as a safety signal. The
 * workflow finds every Active Product Label that shares the flagged
 * ingredient (with a demographic and dose overlap, when specified), opens
 * one Research Request per matched SKU routed to RA at priority='Safety',
 * posts a single digest to #ra-safety, then waits — durably — for each
 * per-request resolution webhook before firing the "sweep complete" Slack.
 *
 * Workflow DevKit API notes (verified against node_modules/workflow/docs):
 *   - There is NO `step.forEach` / `step.parallel` / `step.waitForWebhook`.
 *     The plan §5 sketch was aspirational — real primitives here are:
 *       · a `'use workflow'` function as the orchestrator
 *       · `'use step'` inner functions for retryable work
 *       · `createHook()` for durable waits (see docs/foundations/hooks.mdx)
 *       · `Promise.all(arr.map(...))` for parallel fan-out inside a workflow
 *       · a plain `for (const x of arr) { await step(...) }` for sequential
 *   - Each hook gets a deterministic custom token so the external resolver
 *     (the Notion webhook / manual resolve button) can reconstruct it from
 *     the Request id alone.
 *
 * Fan-out plan:
 *   Step 1 — enumerate-matches (one step, Notion reads).
 *   Step 2 — open one Request per match. Done sequentially inside the
 *            workflow body because the Notion API doesn't like a storm of
 *            parallel writes and each is already its own retryable step.
 *   Step 3 — notify-ra digest (one Slack send with all SKUs).
 *   Step 4 — for each request, create a hook keyed on
 *            `request-resolved:${requestId}` and `await` it. We run these
 *            in parallel inside the workflow so a slow ticket doesn't
 *            block the others.
 *   Step 5 — notify-complete Slack when every request resolves.
 *
 * Timeouts: the plan asks for 90d. `createHook()` does not expose a native
 * timeout option — long runtime is inherent to the DevKit — so we rely on
 * the platform-level TTL. Cancellation is manual via the Workflow run UI if
 * a safety sweep needs to be abandoned.
 */

import { createHook } from 'workflow';
import {
  findLabelsByIngredientDoseAndDemographic,
  openSafetyReviewRequest,
} from '@/lib/label-safety';

const DEFAULT_SITE_URL = 'https://nordic-sqr-rct.vercel.app';

/* -------------------------------------------------------------------------- */
/* Step 1 — enumerate matching labels                                         */
/* -------------------------------------------------------------------------- */

async function enumerateMatches(input) {
  'use step';

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
  'use step';

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
  'use step';

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
  'use step';

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
  'use workflow';

  if (!input || !input.evidenceId || !input.ingredientId) {
    return { ok: false, reason: 'missing evidenceId or ingredientId' };
  }

  // Step 1: enumerate matches.
  const matches = await enumerateMatches(input);
  if (!matches.length) {
    await notifyRaDigest([], input);
    return { ok: true, mode: 'noop', reason: 'no matching labels', matches: 0 };
  }

  // Step 2: open one Request per label, sequentially so Notion doesn't get
  // hammered. Each call is its own retryable step via `'use step'`.
  const requests = [];
  for (const label of matches) {
    const res = await openRequestForLabel(input, label);
    requests.push(res);
  }

  // Step 3: single digest to #ra-safety.
  await notifyRaDigest(requests, input);

  // Step 4: durable wait for each successfully-opened request to resolve.
  // The per-request hook token is `safety-request-resolved:${requestId}` so
  // the Notion webhook or a manual operator call can reconstruct it.
  const resolvable = requests.filter(r => r.id && (r.action === 'created' || r.action === 'updated'));
  if (resolvable.length > 0) {
    await Promise.all(resolvable.map(async (r) => {
      // Manual disposal rather than the TC39 `using` keyword, to stay
      // compatible with the project's current transpile target (see
      // next.config.js — no explicit-resource-management flag set).
      const hook = createHook({ token: `safety-request-resolved:${r.id}` });
      try {
        const payload = await hook;
        console.log(`[ingredient-safety] request ${r.id} resolved:`, payload);
        return payload;
      } finally {
        hook.dispose?.();
      }
    }));
  }

  // Step 5: all done — post completion.
  await notifyComplete(input, resolvable.length);

  return {
    ok: true,
    mode: 'done',
    matches: matches.length,
    requestsOpened: resolvable.length,
    requests: requests.map(r => ({ action: r.action, id: r.id, sku: r.sku, labelId: r.labelId })),
  };
}

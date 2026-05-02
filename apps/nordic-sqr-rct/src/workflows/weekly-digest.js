/**
 * Wave 4.5.2 — Weekly PCS Requests digest workflow.
 *
 * Triggered by Vercel Cron → /api/workflows/weekly-digest → start(weeklyDigestWorkflow).
 *
 * Two delivery modes, auto-selected by env var presence:
 *
 *   Mode A — Fallback (default):
 *     No SLACK_BOT_TOKEN set. A single consolidated digest is posted to the
 *     fallback channel via SLACK_WEBHOOK_URL, grouped by assignee. One HTTP
 *     call per workflow run. This is the current production state and works
 *     with zero new Slack infra.
 *
 *   Mode B — Bot DM (future):
 *     SLACK_BOT_TOKEN present. For each assignee with open requests, resolve
 *     their Slack user ID via NOTION_SLACK_USER_MAP (JSON env var) and DM
 *     their personal queue via chat.postMessage. Unmapped assignees fall
 *     through to the channel (unassigned bucket) so nothing is silently
 *     dropped.
 *
 * Every step is marked `"use step"` so Notion/Slack calls retry with
 * exponential backoff independently. The workflow function itself is a
 * pure orchestrator and runs in the Workflow sandbox.
 *
 * Docs consulted:
 *   - node_modules/workflow/docs/getting-started/next.mdx
 *   - node_modules/workflow/docs/foundations/workflows-and-steps.mdx
 *   - vercel:workflow skill quick reference
 */

import { queryRequests } from '@/lib/pcs-requests';
import { computeAllMetrics } from '@/lib/pcs-requests-metrics';

const DEFAULT_SITE_URL = 'https://nordic-sqr-rct.vercel.app';

/* -------------------------------------------------------------------------- */
/* Step 1 — fetch open requests grouped by assignee                           */
/* -------------------------------------------------------------------------- */

async function fetchOpenRequestsGroupedByAssignee() {
  'use step';

  // queryRequests with filter 'all' returns all open (Status != Done) requests.
  const requests = await queryRequests({ filter: 'all' });

  // Group by first assignee ID; rows with empty assignees go to the synthetic
  // "unassigned" bucket (keyed as null in the map).
  const groups = new Map(); // key = notionUserId | null ("unassigned"), value = { assigneeName, requests[] }
  for (const req of requests) {
    const primary = (req.assignees || [])[0] || null;
    const key = primary?.id || null;
    if (!groups.has(key)) {
      groups.set(key, {
        assigneeId: key,
        assigneeName: primary?.name || 'Unassigned',
        requests: [],
      });
    }
    groups.get(key).requests.push(req);
  }

  // Convert Map -> array of plain serializable objects (Workflow DevKit
  // serialization accepts Map, but arrays of plain objects are safer and
  // easier to inspect in the web UI).
  return Array.from(groups.values());
}

/* -------------------------------------------------------------------------- */
/* Step 2 — resolve Slack recipient for a group                               */
/* -------------------------------------------------------------------------- */

function parseUserMap() {
  const raw = process.env.NOTION_SLACK_USER_MAP || '';
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (err) {
    console.warn('[weekly-digest] NOTION_SLACK_USER_MAP is not valid JSON:', err.message);
    return {};
  }
}

async function resolveSlackRecipient(group) {
  'use step';

  const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN);
  const channelFallback = process.env.SLACK_REQUESTS_CHANNEL || null; // optional channel ID/name override; used by Mode B

  // Mode A: always route to channel (single consolidated digest elsewhere).
  if (!hasBotToken) {
    return { mode: 'channel-webhook', target: null, assigneeId: group.assigneeId };
  }

  // Mode B: map Notion user → Slack user ID.
  if (!group.assigneeId) {
    // Unassigned bucket → channel (if configured).
    return { mode: 'channel-api', target: channelFallback, assigneeId: null };
  }
  const userMap = parseUserMap();
  const slackId = userMap[group.assigneeId];
  if (!slackId) {
    console.warn(`[weekly-digest] No Slack user mapping for Notion user ${group.assigneeId} (${group.assigneeName}); routing to channel.`);
    if (channelFallback) {
      return { mode: 'channel-api', target: channelFallback, assigneeId: group.assigneeId };
    }
    // No channel fallback configured — explicitly signal skip.
    return { mode: 'skip', target: null, assigneeId: group.assigneeId };
  }
  return { mode: 'dm', target: slackId, assigneeId: group.assigneeId };
}

/* -------------------------------------------------------------------------- */
/* Message formatting (pure functions — called inside steps)                  */
/* -------------------------------------------------------------------------- */

const TYPE_LABELS = {
  'template-drift': 'Template drift',
  'low-confidence': 'Low confidence',
  'label-drift': 'Label drift',
  'missing-field': 'Missing field',
};

function groupByType(requests) {
  const buckets = {};
  for (const r of requests) {
    const t = r.requestType || 'other';
    if (!buckets[t]) buckets[t] = [];
    buckets[t].push(r);
  }
  // Sort each bucket by age descending.
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
  }
  return buckets;
}

function ageCodeEmoji(r) {
  if (r.priority === 'Safety') return '🔴';
  if (r.priority === 'High' && (r.ageDays ?? 0) > 14) return '🟠';
  return '⚪';
}

function notionPageUrl(id) {
  return `https://www.notion.so/${String(id || '').replace(/-/g, '')}`;
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}

/**
 * Build Slack blocks for a single assignee's queue. Used by both DM (Mode B)
 * and as a section within the consolidated channel digest (Mode A).
 */
function buildAssigneeSection(group) {
  const { assigneeName, requests } = group;
  const buckets = groupByType(requests);
  const header = { type: 'section', text: { type: 'mrkdwn', text: `*${assigneeName}* — ${requests.length} open request${requests.length === 1 ? '' : 's'}` } };

  const typeBlocks = [];
  for (const type of Object.keys(buckets)) {
    const rows = buckets[type];
    const label = TYPE_LABELS[type] || type;
    const lines = rows.map(r => {
      const field = r.specificField ? ` · \`${r.specificField}\`` : '';
      const age = r.ageDays != null ? ` · ${r.ageDays}d` : '';
      const pcs = (r.pcsVersionId || r.relatedPcsId) ? ` · <${notionPageUrl(r.relatedPcsId || r.pcsVersionId)}|PCS>` : '';
      const link = ` <${notionPageUrl(r.id)}|open>`;
      const title = r.request || '(untitled)';
      return `${ageCodeEmoji(r)} ${title}${field}${age}${pcs}${link}`;
    }).join('\n');
    typeBlocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `_${label}_\n${lines}` },
    });
  }

  return [header, ...typeBlocks];
}

function buildDigestFooterBlocks({ totalRequests, filterHint = 'mine', metrics = null }) {
  const url = `${siteUrl()}/pcs/requests?filter=${filterHint}`;
  const elements = [
    { type: 'mrkdwn', text: `${totalRequests} open request${totalRequests === 1 ? '' : 's'} total · <${url}|View in dashboard>` },
  ];
  if (metrics) {
    const medianStr = metrics.medianTimeToResolve?.all != null ? `${metrics.medianTimeToResolve.all}d` : 'n/a';
    const coverageStr = metrics.coverageDebt?.pctDocumentsWithOpenRequests != null
      ? `${metrics.coverageDebt.pctDocumentsWithOpenRequests}%`
      : 'n/a';
    const p95Str = metrics.staleness?.p95OpenAgeDays != null ? `${metrics.staleness.p95OpenAgeDays}d` : 'n/a';
    elements.push({
      type: 'mrkdwn',
      text: `Weekly health: median resolve ${medianStr} · ${coverageStr} coverage debt · p95 open ${p95Str}`,
    });
  }
  return [
    { type: 'divider' },
    { type: 'context', elements },
  ];
}

/* -------------------------------------------------------------------------- */
/* Step 2.5 — compute health metrics snapshot                                 */
/* -------------------------------------------------------------------------- */

async function computeMetricsSnapshot() {
  'use step';
  console.log('[weekly-digest] computeMetricsSnapshot: start');
  try {
    const metrics = await computeAllMetrics();
    console.log('[weekly-digest] computeMetricsSnapshot: ok', {
      median: metrics.medianTimeToResolve?.all,
      coveragePct: metrics.coverageDebt?.pctDocumentsWithOpenRequests,
      p95: metrics.staleness?.p95OpenAgeDays,
    });
    return metrics;
  } catch (err) {
    // Metrics must never block digest delivery — log and return null so the
    // footer falls back to the plain "X open" line.
    console.warn('[weekly-digest] computeMetricsSnapshot failed:', err?.message || err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Step 3 — send digest (Mode A + Mode B)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mode A: single consolidated digest to SLACK_WEBHOOK_URL, grouped by assignee.
 */
async function sendConsolidatedDigestViaWebhook(groups, metrics = null) {
  'use step';

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    return { sent: false, reason: 'SLACK_WEBHOOK_URL not set' };
  }
  const total = groups.reduce((acc, g) => acc + g.requests.length, 0);
  if (total === 0) {
    return { sent: false, reason: 'No open requests' };
  }

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '📋 Weekly PCS Requests Digest' } },
  ];
  for (const group of groups) {
    blocks.push({ type: 'divider' });
    for (const b of buildAssigneeSection(group)) blocks.push(b);
  }
  blocks.push(...buildDigestFooterBlocks({ totalRequests: total, filterHint: 'all', metrics }));

  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `Weekly PCS Requests Digest (${total} open)`, blocks }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Slack webhook ${resp.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, total };
}

/**
 * Mode B: per-destination send using Slack Web API.
 * destination = { mode: 'dm'|'channel-api', target: slackIdOrChannel }
 */
async function sendGroupViaBotApi(destination, group, metrics = null) {
  'use step';

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN missing in Mode B step');

  const total = group.requests.length;
  if (total === 0) return { sent: false, reason: 'Empty group' };

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '📋 Your PCS Requests — Weekly Digest' } },
    ...buildAssigneeSection(group),
    ...buildDigestFooterBlocks({ totalRequests: total, filterHint: destination.mode === 'dm' ? 'mine' : 'all', metrics }),
  ];

  const body = {
    channel: destination.target, // For DMs Slack accepts a user ID here; chat.postMessage opens the IM automatically.
    text: `Weekly PCS Requests Digest — ${total} open`,
    blocks,
  };

  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.ok) {
    throw new Error(`Slack API error: ${data?.error || resp.status}`);
  }
  return { sent: true, ts: data.ts };
}

/* -------------------------------------------------------------------------- */
/* Workflow orchestrator                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Weekly digest workflow. Runs every Monday at 16:00 UTC (08:00 Pacific standard).
 *
 * NOTE on daylight saving: Vercel Cron expresses schedules in UTC. During
 * Pacific Daylight Time (mid-March to early November) 16:00 UTC = 09:00 PT.
 * During Pacific Standard Time it matches 08:00 PT. The team accepts the
 * one-hour drift; a future improvement could split into two cron entries
 * with date-guarded short-circuits, or switch to a workflow-internal
 * scheduler that understands TZ.
 */
export async function weeklyDigestWorkflow() {
  'use workflow';

  const groups = await fetchOpenRequestsGroupedByAssignee();
  if (!Array.isArray(groups) || groups.length === 0) {
    return { ok: true, mode: 'noop', reason: 'No open requests' };
  }

  // Wave 4.5.4 — compute health metrics alongside the group fetch. The step
  // swallows its own errors and returns null on failure so digest delivery
  // is never blocked by a metrics regression.
  const metrics = await computeMetricsSnapshot();

  // Mode A or Mode B — decided once per run by env inspection in the step.
  const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN);

  if (!hasBotToken) {
    const result = await sendConsolidatedDigestViaWebhook(groups, metrics);
    return { ok: true, mode: 'A-webhook', result, metrics };
  }

  // Mode B: fan out one send step per group.
  const results = [];
  for (const group of groups) {
    const destination = await resolveSlackRecipient(group);
    if (destination.mode === 'skip') {
      results.push({ assigneeId: group.assigneeId, skipped: true, reason: 'no-mapping-and-no-channel' });
      continue;
    }
    const send = await sendGroupViaBotApi(destination, group, metrics);
    results.push({ assigneeId: group.assigneeId, destination: destination.mode, ...send });
  }
  return { ok: true, mode: 'B-bot', groups: results.length, results, metrics };
}

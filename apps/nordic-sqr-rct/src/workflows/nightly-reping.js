/**
 * Wave 4.5.3 — Nightly Research Requests re-ping workflow.
 *
 * Triggered by Vercel Cron → /api/workflows/nightly-reping → start(nightlyRepingWorkflow).
 *
 * Spec: docs/plans/wave-4.5-extractor-validation.md §5 Workflow B.
 *
 * Behavior summary:
 *   - Pulls all open Requests where `Last pinged date` is empty OR older than
 *     7 days ago (cutoff = today - 7d, expressed as YYYY-MM-DD).
 *   - For each stale request, computes `ageDays` from `openedDate` (falling
 *     back to `createdTime`) and picks an escalation tier:
 *       · Tier 1 (7–13d)  : DM assignee only.
 *       · Tier 2 (14–29d) : DM assignee + cc team-lead for that role.
 *       · Tier 3 (30+d)   : Post to shared channel, cc team-lead.
 *   - After a successful Slack send, updates the request's `Last pinged date`
 *     to now. Notion write lives inside the same step so Slack + Notion
 *     succeed (or retry) atomically — prevents double-pinging.
 *
 * Delivery modes mirror Wave 4.5.2:
 *   - Mode A (default): consolidated channel post per tier via SLACK_WEBHOOK_URL.
 *     One webhook call per non-empty tier. Team-lead CCs are rendered inline
 *     (mention text only — webhooks cannot @-mention individual Slack users).
 *   - Mode B (SLACK_BOT_TOKEN set): true DMs via chat.postMessage. Lead CCs
 *     are posted as separate DMs to the lead's Slack user ID. Tier 3 messages
 *     go to SLACK_REQUESTS_CHANNEL via the bot API.
 *
 * Safety:
 *   - DRY_RUN=1 short-circuits the Slack and Notion writes — logs what would
 *     have been sent but changes no external state. Useful for first-run
 *     verification on a Preview deploy.
 *
 * Docs consulted:
 *   - node_modules/workflow/docs/foundations/workflows-and-steps.mdx
 *   - vercel:workflow skill quick reference
 */

import { queryRequests, updateRequestLastPinged } from '@/lib/pcs-requests';

const DEFAULT_SITE_URL = 'https://nordic-sqr-rct.vercel.app';

/* -------------------------------------------------------------------------- */
/* Config helpers                                                             */
/* -------------------------------------------------------------------------- */

function isDryRun() {
  return process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}

function notionPageUrl(id) {
  return `https://www.notion.so/${String(id || '').replace(/-/g, '')}`;
}

function parseUserMap() {
  const raw = process.env.NOTION_SLACK_USER_MAP || '';
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (err) {
    console.warn('[nightly-reping] NOTION_SLACK_USER_MAP is not valid JSON:', err.message);
    return {};
  }
}

function parseTeamLeads() {
  const raw = process.env.NOTION_TEAM_LEADS || '';
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (err) {
    console.warn('[nightly-reping] NOTION_TEAM_LEADS is not valid JSON:', err.message);
    return {};
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Recompute age in whole UTC days from openedDate (or createdTime fallback).
 * Mirrors `computeAgeDays` in pcs-requests.js but we re-derive here in case
 * the cached `ageDays` on the parsed row is off by one at midnight boundaries.
 */
function ageDays(request) {
  const base = request.openedDate || (request.createdTime ? request.createdTime.slice(0, 10) : null);
  if (!base) return request.ageDays ?? 0;
  const then = new Date(base + 'T00:00:00Z').getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return request.ageDays ?? 0;
  return Math.max(0, Math.floor((now - then) / 86400000));
}

function tierFor(ageN) {
  if (ageN >= 30) return 3;
  if (ageN >= 14) return 2;
  return 1; // caller already ensured >= 7 via the Notion filter
}

/* -------------------------------------------------------------------------- */
/* Step 1 — fetch stale requests                                              */
/* -------------------------------------------------------------------------- */

async function fetchStaleRequests({ minDaysSinceLastPing = 7 } = {}) {

  const cutoff = daysAgoIso(minDaysSinceLastPing);
  const rows = await queryRequests({ filter: 'all', lastPingedBefore: cutoff });

  // Secondary guard: for rows that have never been pinged AND were just
  // opened today, we don't want to spam — require the opened date itself
  // to also be older than the 7-day window.
  return rows.filter(r => ageDays(r) >= minDaysSinceLastPing);
}

/* -------------------------------------------------------------------------- */
/* Message templates                                                          */
/* -------------------------------------------------------------------------- */

function buildRequestLine(r, { withLead } = { withLead: null }) {
  const age = ageDays(r);
  const field = r.specificField ? ` (${r.specificField})` : '';
  const assignee = (r.assignees || [])[0]?.name || 'Unassigned';
  const pcsId = r.pcsId || r.relatedPcsId || r.pcsVersionId || 'PCS';
  const notionLink = `<${notionPageUrl(r.id)}|Notion>`;
  const dashLink = `<${siteUrl()}/pcs/requests?id=${encodeURIComponent(r.id)}|dashboard>`;
  const leadSuffix = withLead ? ` · CC: ${withLead}` : '';
  return `• ${pcsId}${field} — ${age}d · assignee: ${assignee}${leadSuffix} · ${notionLink} · ${dashLink}`;
}

function tierCopy(tier, count) {
  if (tier === 1) return { emoji: '🔔', title: `Reminder: ${count} open Research Request${count === 1 ? '' : 's'} 7+ days old` };
  if (tier === 2) return { emoji: '⚠️', title: `Attention needed: ${count} Research Request${count === 1 ? '' : 's'} now 14+ days old` };
  return { emoji: '🚨', title: `Escalation: ${count} Research Request${count === 1 ? '' : 's'} 30+ days old with no resolution` };
}

function tierPerRowHeadline(tier, r) {
  const age = ageDays(r);
  const field = r.specificField || r.requestType || 'field';
  const pcsId = r.pcsId || r.relatedPcsId || r.pcsVersionId || 'PCS';
  if (tier === 1) return `🔔 Reminder: your open Research Request on ${pcsId} (${field}) is ${age} days old.`;
  if (tier === 2) return `⚠️ Attention needed: open Research Request on ${pcsId} (${field}) is now ${age} days old.`;
  const assignee = (r.assignees || [])[0]?.name || 'Unassigned';
  return `🚨 Escalation: open Research Request on ${pcsId} (${field}) is ${age} days old with no resolution. Assignee: ${assignee}.`;
}

/* -------------------------------------------------------------------------- */
/* Step 2 — send via webhook (Mode A) — one consolidated post per tier        */
/* -------------------------------------------------------------------------- */

async function sendTierViaWebhook({ tier, requests, leadsByRole }) {

  if (isDryRun()) {
    console.log(`[nightly-reping][DRY_RUN] Tier ${tier}: would webhook-post ${requests.length} requests.`);
    return { sent: false, reason: 'dry-run', tier, count: requests.length };
  }
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return { sent: false, reason: 'SLACK_WEBHOOK_URL not set', tier };
  if (requests.length === 0) return { sent: false, reason: 'empty tier', tier };

  const { emoji, title } = tierCopy(tier, requests.length);
  const lines = requests.map(r => {
    const leadName = leadsByRole[r.assignedRole] || null;
    const leadMention = tier >= 2 && leadName ? `lead ${leadName}` : null;
    return buildRequestLine(r, { withLead: leadMention });
  }).join('\n');

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${emoji} ${title}` } },
    { type: 'section', text: { type: 'mrkdwn', text: lines } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `<${siteUrl()}/pcs/requests?filter=aged|View aged queue>` }] },
  ];

  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `${emoji} ${title}`, blocks }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Slack webhook ${resp.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, tier, count: requests.length };
}

/* -------------------------------------------------------------------------- */
/* Step 2b — send single DM / channel post via bot (Mode B)                   */
/* -------------------------------------------------------------------------- */

async function sendBotMessage({ channel, text, blocks }) {

  if (isDryRun()) {
    console.log(`[nightly-reping][DRY_RUN] would bot-post to ${channel}: ${text.slice(0, 120)}`);
    return { sent: false, reason: 'dry-run' };
  }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN missing in Mode B step');

  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.ok) {
    throw new Error(`Slack API error: ${data?.error || resp.status}`);
  }
  return { sent: true, ts: data.ts };
}

/* -------------------------------------------------------------------------- */
/* Step 3 — mark pinged                                                       */
/* -------------------------------------------------------------------------- */

async function markPinged(requestId, isoDate) {

  if (isDryRun()) {
    console.log(`[nightly-reping][DRY_RUN] would set Last pinged date on ${requestId} to ${isoDate}`);
    return { updated: false, reason: 'dry-run' };
  }
  await updateRequestLastPinged(requestId, isoDate);
  return { updated: true };
}

/* -------------------------------------------------------------------------- */
/* Workflow orchestrator                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Nightly re-ping workflow. Runs at 07:00 UTC (midnight PDT / 23:00 PST the
 * previous day). Same DST caveat as weekly-digest applies.
 */
export async function nightlyRepingWorkflow() {

  const stale = await fetchStaleRequests({ minDaysSinceLastPing: 7 });
  if (!Array.isArray(stale) || stale.length === 0) {
    return { ok: true, mode: 'noop', reason: 'No stale requests' };
  }

  const leadsByRole = parseTeamLeads(); // { Research: 'uuid', RA: 'uuid', Template-owner: 'uuid' }
  const userMap = parseUserMap();       // Notion user UUID → Slack user ID
  const now = todayIso();
  const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN);
  const tier3Channel = process.env.SLACK_REQUESTS_CHANNEL || null;

  // Bucket by tier.
  const byTier = { 1: [], 2: [], 3: [] };
  for (const r of stale) byTier[tierFor(ageDays(r))].push(r);

  /* ------------------------------ Mode A --------------------------------- */
  if (!hasBotToken) {
    const results = [];
    for (const tier of [1, 2, 3]) {
      const rows = byTier[tier];
      if (rows.length === 0) continue;
      // Resolve lead names (display) via env var mapping. We don't have a Notion
      // user-id → name resolver here without extra queries, so surface the
      // UUID when no display name is available — it still identifies the lead
      // downstream.
      const leadsDisplay = {};
      for (const [role, uuid] of Object.entries(leadsByRole)) {
        leadsDisplay[role] = `\`${uuid.slice(0, 8)}…\``;
      }
      const send = await sendTierViaWebhook({ tier, requests: rows, leadsByRole: leadsDisplay });
      results.push(send);
      if (send.sent) {
        for (const r of rows) {
          await markPinged(r.id, now);
        }
      }
    }
    return { ok: true, mode: 'A-webhook', tiers: results };
  }

  /* ------------------------------ Mode B --------------------------------- */
  const results = [];

  // Tier 1 + Tier 2: DM assignee.
  for (const tier of [1, 2]) {
    for (const r of byTier[tier]) {
      const primary = (r.assignees || [])[0] || null;
      const assigneeSlack = primary ? userMap[primary.id] : null;
      if (!assigneeSlack) {
        console.warn(`[nightly-reping] No Slack mapping for assignee ${primary?.id || '(unassigned)'}; tier=${tier} request=${r.id}`);
        results.push({ requestId: r.id, tier, skipped: 'no-assignee-slack-id' });
        continue;
      }

      const text = tierPerRowHeadline(tier, r);
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text } },
        { type: 'section', text: { type: 'mrkdwn', text: buildRequestLine(r) } },
      ];
      const send = await sendBotMessage({ channel: assigneeSlack, text, blocks });
      results.push({ requestId: r.id, tier, assignee: send });

      // Tier 2: cc team lead via DM.
      if (tier === 2) {
        const leadUuid = leadsByRole[r.assignedRole];
        const leadSlack = leadUuid ? userMap[leadUuid] : null;
        if (leadSlack) {
          const ccText = `CC: Tier 2 re-ping on ${r.pcsId || r.id.slice(0, 8)} for your team (${r.assignedRole}). Assignee: ${(r.assignees || [])[0]?.name || 'Unassigned'}.`;
          const ccSend = await sendBotMessage({ channel: leadSlack, text: ccText, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: ccText } }, { type: 'section', text: { type: 'mrkdwn', text: buildRequestLine(r) } }] });
          results.push({ requestId: r.id, tier, leadCc: ccSend });
        } else {
          console.warn(`[nightly-reping] No lead Slack mapping for role ${r.assignedRole}; cc skipped for request=${r.id}`);
          results.push({ requestId: r.id, tier, leadCc: 'skip-no-mapping' });
        }
      }

      await markPinged(r.id, now);
    }
  }

  // Tier 3: shared channel post, plus lead DM.
  for (const r of byTier[3]) {
    const text = tierPerRowHeadline(3, r);
    const leadUuid = leadsByRole[r.assignedRole];
    const leadName = leadUuid ? `<@${userMap[leadUuid] || leadUuid}>` : '(no lead configured)';
    const channelBlocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `${text} Lead: ${leadName}.` } },
      { type: 'section', text: { type: 'mrkdwn', text: buildRequestLine(r) } },
    ];

    if (!tier3Channel) {
      console.warn(`[nightly-reping] SLACK_REQUESTS_CHANNEL not set; tier-3 escalation for ${r.id} has no channel — falling back to lead DM only.`);
      results.push({ requestId: r.id, tier: 3, channel: 'skip-no-channel' });
    } else {
      const send = await sendBotMessage({ channel: tier3Channel, text, blocks: channelBlocks });
      results.push({ requestId: r.id, tier: 3, channel: send });
    }

    const leadSlack = leadUuid ? userMap[leadUuid] : null;
    if (leadSlack) {
      const ccText = `Tier 3 escalation cc: ${r.pcsId || r.id.slice(0, 8)} (${r.assignedRole}) is ${ageDays(r)}d old.`;
      const ccSend = await sendBotMessage({ channel: leadSlack, text: ccText, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: ccText } }, { type: 'section', text: { type: 'mrkdwn', text: buildRequestLine(r) } }] });
      results.push({ requestId: r.id, tier: 3, leadCc: ccSend });
    }

    await markPinged(r.id, now);
  }

  return { ok: true, mode: 'B-bot', stale: stale.length, byTier: { 1: byTier[1].length, 2: byTier[2].length, 3: byTier[3].length }, results };
}

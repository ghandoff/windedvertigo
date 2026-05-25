/**
 * Slack incoming-webhook notifier. Posts batch completion summaries.
 * Env var: SLACK_WEBHOOK_URL (optional — notifications no-op if unset).
 */

/**
 * Post a batch completion notification to Slack.
 * @param {object} args
 * @param {string} args.batchId
 * @param {{committed:number, failed:number, skipped:number, total:number, templateCounts?:{lauren:number, partial:number, legacy:number, unknown:number}}} args.stats
 * @param {string[]} [args.sanityWarnings] — aggregated [SANITY]/[PREFLIGHT] warnings
 * @param {string} [args.dashboardBaseUrl] — override for the dashboard link (defaults to production)
 * @param {Array<{pcsId:string, productName?:string|null}>} [args.legacyDocs] — PCS docs classified as Legacy pre-Lauren (re-issue candidates)
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
export async function notifyBatchComplete({ batchId, stats, sanityWarnings = [], dashboardBaseUrl, legacyDocs = [] }) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return { sent: false, reason: 'SLACK_WEBHOOK_URL not set' };

  const base = dashboardBaseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://nordic-sqr-rct.vercel.app';
  const dashLink = `${base}/pcs/admin/imports?batchId=${encodeURIComponent(batchId)}`;

  const emoji = stats.failed > 0 ? '⚠️' : '✅';
  const summary = `${emoji} PCS Import Batch \`${batchId}\` complete`;

  // Template-version breakdown inline with committed count (Wave 3.7).
  const tc = stats.templateCounts;
  let committedLine = `• Committed: ${stats.committed}`;
  if (tc) {
    const parts = [];
    if (tc.lauren) parts.push(`${tc.lauren} Lauren`);
    if (tc.partial) parts.push(`${tc.partial} Partial`);
    if (tc.legacy) parts.push(`${tc.legacy} Legacy ⚠️`);
    if (tc.unknown) parts.push(`${tc.unknown} Unknown`);
    if (parts.length > 0) committedLine = `• Committed: ${stats.committed} (${parts.join(' · ')})`;
  }

  const detail = [
    committedLine,
    stats.failed > 0 ? `• Failed: ${stats.failed}` : null,
    stats.skipped > 0 ? `• Skipped: ${stats.skipped}` : null,
    `• Total: ${stats.total}`,
  ].filter(Boolean).join('\n');

  const legacyBlock = (Array.isArray(legacyDocs) && legacyDocs.length > 0)
    ? `\n\n*Legacy pre-Lauren — recommend re-issue:*\n${legacyDocs.slice(0, 10).map(d => `• ${d.pcsId}${d.productName ? ` (${d.productName})` : ''}`).join('\n')}${legacyDocs.length > 10 ? `\n…and ${legacyDocs.length - 10} more` : ''}`
    : '';

  const warningsBlock = sanityWarnings.length > 0
    ? `\n\n*Warnings:*\n${sanityWarnings.slice(0, 5).map(w => `• ${w}`).join('\n')}${sanityWarnings.length > 5 ? `\n…and ${sanityWarnings.length - 5} more` : ''}`
    : '';

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: `*${summary}*` } },
    { type: 'section', text: { type: 'mrkdwn', text: detail } },
  ];
  if (legacyBlock) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: legacyBlock.trimStart() } });
  }
  if (warningsBlock) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: warningsBlock.trimStart() } });
  }
  blocks.push({ type: 'actions', elements: [
    { type: 'button', text: { type: 'plain_text', text: 'Open dashboard' }, url: dashLink },
  ]});

  const body = {
    text: summary,
    blocks,
  };

  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return { sent: false, reason: `Slack webhook returned ${resp.status}: ${await resp.text()}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Slack webhook error: ${err.message}` };
  }
}

/**
 * Post an in-app feedback submission (Wave 6.1) to Slack.
 * Reuses SLACK_WEBHOOK_URL. No-ops if unset.
 *
 * @param {object} args
 * @param {'bug'|'confusion'|'idea'|'other'} args.category
 * @param {string} args.message - User's feedback text
 * @param {boolean} [args.emailBack]
 * @param {object} args.context
 * @param {string} [args.context.pageUrl]
 * @param {string} [args.context.userAlias]
 * @param {string} [args.context.userName]
 * @param {string[]} [args.context.roles]
 * @param {string} [args.context.commitSha]
 * @param {string} [args.context.userAgent]
 * @param {string} [args.context.viewport]
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
export async function notifyFeedback({ category, message, emailBack, context = {} }) {
  // Routing policy:
  //   1) If SLACK_BOT_TOKEN + SLACK_FEEDBACK_CHANNEL are both set, use
  //      chat.postMessage to that channel (preferred — lets us point at a
  //      project-specific channel like #nordic-updates without provisioning
  //      a dedicated Incoming Webhook URL).
  //   2) Else fall back to the legacy SLACK_WEBHOOK_URL path (whatever
  //      channel that webhook is bound to — typically a generic feedback
  //      sink).
  //   3) Else return {sent: false, reason: ...} so the API route can 500
  //      with a user-visible toast.
  const botToken = process.env.SLACK_BOT_TOKEN;
  const feedbackChannel = process.env.SLACK_FEEDBACK_CHANNEL;
  const webhook = process.env.SLACK_WEBHOOK_URL;

  if (!botToken && !webhook) {
    return { sent: false, reason: 'Neither SLACK_BOT_TOKEN+SLACK_FEEDBACK_CHANNEL nor SLACK_WEBHOOK_URL is set' };
  }
  if (botToken && !feedbackChannel && !webhook) {
    return { sent: false, reason: 'SLACK_BOT_TOKEN set but SLACK_FEEDBACK_CHANNEL is missing and no webhook fallback' };
  }

  const categoryMeta = {
    bug:       { emoji: '🐛', label: 'bug',       color: '#dc2626' },
    confusion: { emoji: '❓', label: 'confusion', color: '#2563eb' },
    idea:      { emoji: '💡', label: 'idea',      color: '#ca8a04' },
    other:     { emoji: '💬', label: 'other',     color: '#6b7280' },
  };
  const meta = categoryMeta[category] || categoryMeta.other;

  const { pageUrl, userAlias, userName, roles, commitSha, userAgent, viewport } = context;
  const roleLabel = Array.isArray(roles) && roles.length > 0 ? roles.join('/') : 'user';
  const whoLine = `${userName || userAlias || 'Unknown'} (${roleLabel})`;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const buildLabel = commitSha ? `build \`${String(commitSha).slice(0, 7)}\`` : 'build unknown';

  const headerText = `${meta.emoji} *[${meta.label}]*${pageUrl ? ` · \`${pageUrl}\`` : ''}`;
  const metaLine = `${whoLine} · ${ts} · ${buildLabel}`;
  const quoted = String(message || '').split('\n').map(l => `> ${l}`).join('\n');

  const detailLines = [];
  if (typeof emailBack === 'boolean') detailLines.push(`Email back: ${emailBack ? 'yes' : 'no'}`);
  if (userAgent) detailLines.push(`UA: ${userAgent.slice(0, 120)}`);
  if (viewport) detailLines.push(`Viewport: ${viewport}`);

  const attachmentBlocks = [
    { type: 'section', text: { type: 'mrkdwn', text: headerText } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: metaLine }] },
    { type: 'section', text: { type: 'mrkdwn', text: quoted || '_(no message)_' } },
  ];
  if (detailLines.length > 0) {
    attachmentBlocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: detailLines.join(' · ') }],
    });
  }

  const fallbackText = `${meta.emoji} Feedback [${meta.label}] from ${userAlias || 'user'}`;

  // Preferred path: bot token + channel
  if (botToken && feedbackChannel) {
    try {
      const resp = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: feedbackChannel,
          text: fallbackText,
          attachments: [{ color: meta.color, blocks: attachmentBlocks }],
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok === false) {
        const reason = `chat.postMessage failed: status=${resp.status} error=${data?.error || '?'} channel=${feedbackChannel}`;
        // If the bot isn't in the channel, fall through to webhook (if configured)
        // so feedback still lands somewhere. Otherwise return the failure.
        if (data?.error === 'not_in_channel' || data?.error === 'channel_not_found') {
          if (!webhook) return { sent: false, reason: `${reason} (and no webhook fallback)` };
          // fall through to webhook
        } else {
          return { sent: false, reason };
        }
      } else {
        return { sent: true };
      }
    } catch (err) {
      if (!webhook) return { sent: false, reason: `chat.postMessage threw: ${err.message}` };
      // fall through to webhook
    }
  }

  // Fallback path: incoming webhook
  const body = {
    text: fallbackText,
    attachments: [{ color: meta.color, blocks: attachmentBlocks }],
  };
  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return { sent: false, reason: `Slack webhook returned ${resp.status}: ${await resp.text()}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Slack webhook error: ${err.message}` };
  }
}

/**
 * Notify admin (Garrett) that a delete request has been submitted.
 * Reuses SLACK_WEBHOOK_URL. No-ops if unset.
 *
 * @param {object} args
 * @param {string} args.resourceType  — e.g. "Evidence", "Claim"
 * @param {string} args.resourceName  — display name of the record
 * @param {string} args.resourceUrl   — full URL to the record in the platform
 * @param {string} args.requestedBy   — name or email of the requester
 * @param {string} args.reason        — reason entered by the requester
 * @param {string} [args.adminUrl]    — link to the admin delete-request queue
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
export async function notifyDeleteRequest({ resourceType, resourceName, resourceUrl, requestedBy, reason, adminUrl }) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return { sent: false, reason: 'SLACK_WEBHOOK_URL not set' };

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://nordic.windedvertigo.com';
  const queueUrl = adminUrl || `${base}/research/pcs/requests?requestType=Delete`;

  const headerText = `🗑️ *Delete request — ${resourceType}*`;
  const nameQuoted = resourceName ? `"${resourceName}"` : '(unnamed)';
  const bodyText = `${nameQuoted}\nRequested by: *${requestedBy || 'unknown'}*\nReason: ${reason || '_(no reason given)_'}`;

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: headerText } },
    { type: 'section', text: { type: 'mrkdwn', text: bodyText } },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Review queue' }, url: queueUrl },
        { type: 'button', text: { type: 'plain_text', text: 'Open record' }, url: resourceUrl || base },
      ],
    },
  ];

  const slackBody = {
    text: `🗑️ Delete request (${resourceType}): ${resourceName || 'unknown'} — from ${requestedBy || 'user'}`,
    blocks,
  };

  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackBody),
    });
    if (!resp.ok) {
      return { sent: false, reason: `Slack webhook returned ${resp.status}: ${await resp.text()}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Slack webhook error: ${err.message}` };
  }
}

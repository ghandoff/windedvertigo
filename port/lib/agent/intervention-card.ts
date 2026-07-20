/**
 * Slack Block Kit card renderer for agent_interventions — the "what I want
 * to do · because [trigger] · the artifact · tier · deadline" preview card
 * (docs/prompts/executive-agents-phase1-build.md §2.4), plus the
 * approve/edit/redirect/ignore action buttons for HIGH-tier previews.
 *
 * No interactive Block Kit builder existed anywhere in this codebase before
 * this file (lib/slack.ts's `blocks?: any[]` param has always accepted
 * arbitrary blocks, but nothing constructed interactive `actions` elements).
 * Button clicks are handled by app/api/agent/slack/interactive/route.ts,
 * which is the FIRST Slack interactivity receiver in the repo — requires a
 * new "Interactivity & Shortcuts" Request URL configured in the wv-claw
 * Slack app (a human gate, not auto-provisioned).
 */

import type { InterventionRow } from "@/lib/supabase/agent-interventions";

const AGENT_LABELS: Record<InterventionRow["agent"], string> = {
  mo: "Mo",
  pam: "PaM",
  carl: "cARL",
  opsy: "Opsy",
  fin: "Fin",
  biz: "Biz",
};

const TIER_EMOJI: Record<InterventionRow["riskTier"], string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

function artifactText(artifact: Record<string, unknown> | null): string {
  if (!artifact) return "_(no artifact attached)_";
  const title = typeof artifact.title === "string" ? artifact.title : null;
  const body = typeof artifact.body === "string" ? artifact.body : null;
  if (title && body) return `*${title}*\n${body}`;
  if (body) return body;
  return "```" + JSON.stringify(artifact, null, 2).slice(0, 2000) + "```";
}

/**
 * Renders the card for a `proposed` HIGH-tier intervention, with interactive
 * approve/edit/redirect/ignore buttons. `action_id` carries the decision
 * (`intervention:approve` etc.); `value` carries the intervention id — the
 * interactive route dispatches on the former and looks up the row by the
 * latter. Not used for LOW/MEDIUM (those execute immediately, no buttons —
 * see buildResolvedBlocks for the notify-only rendering).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildInterventionBlocks(row: InterventionRow): any[] {
  const deadline = row.expiresAt
    ? `\n⏳ *decide by* <!date^${Math.floor(new Date(row.expiresAt).getTime() / 1000)}^{date_short_pretty} {time}|${row.expiresAt}> — no response = *default-deny*`
    : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${TIER_EMOJI[row.riskTier]} *${AGENT_LABELS[row.agent]}* wants to: ${row.trigger}${deadline}`,
      },
    },
    { type: "section", text: { type: "mrkdwn", text: artifactText(row.artifact) } },
    ...(row.rationale
      ? [{ type: "context", elements: [{ type: "mrkdwn", text: `_${row.rationale}_` }] }]
      : []),
    {
      type: "actions",
      block_id: "intervention_actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "intervention:approve",
          value: row.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Edit" },
          action_id: "intervention:edit",
          value: row.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Redirect" },
          action_id: "intervention:redirect",
          value: row.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Ignore" },
          style: "danger",
          action_id: "intervention:ignore",
          value: row.id,
        },
      ],
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `trigger: \`${row.id}\` · winded.vertigo ambient agents` }],
    },
  ];
}

/** Plain-text fallback (Slack requires `text` even when `blocks` is set). */
export function interventionFallbackText(row: InterventionRow): string {
  return `${AGENT_LABELS[row.agent]} wants to: ${row.trigger}`;
}

const RESOLUTION_EMOJI: Record<string, string> = {
  approved: "✅",
  edited: "✏️",
  redirected: "↪️",
  ignored: "🚫",
  expired: "⌛",
};

/**
 * Replacement blocks posted back via response_url once a card is resolved —
 * strips the action buttons and shows who decided what, mirroring
 * lib/escalation.ts's threaded ":large_green_circle: resolved" pattern for
 * consistency across the two notify-and-track systems.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildResolvedBlocks(row: InterventionRow): any[] {
  const emoji = RESOLUTION_EMOJI[row.status] ?? "•";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${TIER_EMOJI[row.riskTier]} *${AGENT_LABELS[row.agent]}* wanted to: ${row.trigger}`,
      },
    },
    { type: "section", text: { type: "mrkdwn", text: artifactText(row.artifact) } },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${emoji} *${row.status}* by ${row.human ?? "?"}${row.outcomeNotes ? ` — ${row.outcomeNotes}` : ""}`,
        },
      ],
    },
  ];
}

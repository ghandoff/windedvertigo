/**
 * Soundings — Slack message builders + senders (Block Kit).
 *
 * Four message shapes, all deliberately quiet:
 *   - kickoff: thread reply under the one-pager root — questions with 👤/🤖
 *     provenance, the deadline, and the explicit contract ("silence just
 *     means consent")
 *   - reminder DM: individual, once EVER per reviewer per sounding — and it
 *     says so ("this is the only nudge you'll get")
 *   - digest: one thread reply (broadcast) — themes / disagreements / actions;
 *     the context line counts inputs, never people
 *   - receipt DM: quotes the reviewer's own words + what changed. This is the
 *     ONLY reviewer-facing feedback in the whole system — informational,
 *     unexpected, zero gamification.
 *
 * All senders reuse lib/slack.ts and inherit its fail-open posture.
 */

import {
  sendDm,
  sendDmByEmail,
  postThreadReplyDetailed,
} from "@/lib/slack";
import type { SoundingRow, SoundingDigestJson } from "@/lib/supabase/soundings";
import type { SoundingReviewerRow } from "@/lib/supabase/sounding-reviewers";
import type { SoundingItemRow } from "@/lib/supabase/sounding-items";
import { slackMessagePermalink } from "./logic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Blocks = any[];

/** `<!date^…>` renders in each viewer's own timezone, with a PT fallback. */
function slackDate(iso: string): string {
  const unix = Math.floor(new Date(iso).getTime() / 1000);
  const fallback = new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `<!date^${unix}^{date_short_pretty} at {time}|${fallback} PT>`;
}

function questionLines(sounding: SoundingRow): string {
  return sounding.questions
    .map((q) => `• ${q.askedByType === "human" ? "👤" : "🤖"} *${q.askedByName}* — _${q.text}_`)
    .join("\n");
}

// ── kickoff ──────────────────────────────────────────────────────────────────

export function buildKickoffBlocks(sounding: SoundingRow): Blocks {
  const blocks: Blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `🔔 *sounding board open* — quick takes on this one, in your own voice, before wednesday's whirlpool.\n` +
          `*closes:* ${slackDate(sounding.deadlineAt)}`,
      },
    },
  ];
  if (sounding.questions.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*questions on the table:*\n${questionLines(sounding)}` },
    });
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text:
          "🎙 reply in this thread with a voice note (or text) — claude transcribes it and maria gets one digest, with your name on your points · " +
          "react 🙅 to pass, totally fine · silence just means consent; this closes itself before the whirlpool",
      },
    ],
  });
  return blocks;
}

/** Post the kickoff as a thread reply under the sounding's root message.
 *  Returns the reply's ts (stored for audit), or null on failure. */
export async function postSoundingKickoff(sounding: SoundingRow): Promise<string | null> {
  const res = await postThreadReplyDetailed(
    sounding.slackChannelId,
    sounding.slackThreadTs,
    `sounding board open — notes wanted before wednesday's whirlpool`,
    false, // the root post already broadcast; keep the kickoff inside the thread
    buildKickoffBlocks(sounding),
  );
  return res.ok ? (res.ts ?? null) : null;
}

// ── reminder DM ──────────────────────────────────────────────────────────────

export function buildReminderBlocks(sounding: SoundingRow): Blocks {
  const link = slackMessagePermalink(sounding.slackChannelId, sounding.slackThreadTs);
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `👋 one sounding is still open for you: *<${link}|${sounding.docTitle}>*\n` +
          `closes ${slackDate(sounding.deadlineAt)}. a 30-second voice note in the thread is plenty — ` +
          `or react 🙅 to pass. if it closes quietly, that's fine too.`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "this is the only nudge you'll get — promise." }],
    },
  ];
}

/** DM ONE reviewer their single reminder. Caller must have won claimReminder() first. */
export async function sendReminderDm(
  sounding: SoundingRow,
  reviewer: SoundingReviewerRow,
): Promise<boolean> {
  const text = `one sounding closes soon: ${sounding.docTitle} — a voice note or 🙅 both work`;
  const blocks = buildReminderBlocks(sounding);
  if (reviewer.slackUserId) return sendDm(reviewer.slackUserId, text, blocks);
  return sendDmByEmail(reviewer.email, text, blocks);
}

// ── digest ───────────────────────────────────────────────────────────────────

export function buildDigestBlocks(
  sounding: SoundingRow,
  digest: SoundingDigestJson,
  counts: { voice: number; text: number; pass: number },
): Blocks {
  const blocks: Blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `🌀 sounding digest — ${sounding.docTitle}`.slice(0, 150) },
    },
  ];
  if (digest.themes.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*themes*\n${digest.themes.map((t) => `• ${t}`).join("\n")}` },
    });
  }
  if (digest.conflicts.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*where notes disagree*\n${digest.conflicts.map((c) => `• ${c}`).join("\n")}`,
      },
    });
  }
  if (digest.actions.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*suggested actions*\n${digest.actions
          .map((a) => `• _(${a.section})_ ${a.action}`)
          .join("\n")}`,
      },
    });
  }
  // Counts describe INPUTS, not people — no names attached to response stats.
  const parts: string[] = [];
  if (counts.voice) parts.push(`${counts.voice} voice ${counts.voice === 1 ? "note" : "notes"}`);
  if (counts.text) parts.push(`${counts.text} text ${counts.text === 1 ? "note" : "notes"}`);
  if (counts.pass) parts.push(`${counts.pass} ${counts.pass === 1 ? "pass" : "passes"}`);
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `from ${parts.length ? parts.join(" · ") : "the thread"} — synthesized for wednesday's whirlpool`,
      },
    ],
  });
  return blocks;
}

/** Post the digest as a broadcast thread reply. Returns the reply ts, or null. */
export async function postSoundingDigest(
  sounding: SoundingRow,
  digest: SoundingDigestJson,
  counts: { voice: number; text: number; pass: number },
): Promise<string | null> {
  const res = await postThreadReplyDetailed(
    sounding.slackChannelId,
    sounding.slackThreadTs,
    `sounding digest — ${sounding.docTitle}: notes synthesized for wednesday`,
    true, // broadcast — the digest is the thing the channel should see
    buildDigestBlocks(sounding, digest, counts),
  );
  return res.ok ? (res.ts ?? null) : null;
}

/** The gentle close for a sounding that expired with zero notes. No shame. */
export async function postExpiryNote(sounding: SoundingRow): Promise<boolean> {
  const res = await postThreadReplyDetailed(
    sounding.slackChannelId,
    sounding.slackThreadTs,
    `🌊 closing this sounding — no notes this round, and that's completely fine. on to wednesday.`,
    false, // stay inside the thread; an expiry needs no channel airtime
  );
  return res.ok;
}

// ── receipt DM ───────────────────────────────────────────────────────────────

/** ~140-char excerpt of the reviewer's own words, for the receipt quote. */
function itemExcerpt(item: SoundingItemRow): string {
  const source = item.kind === "text" ? item.textBody : item.transcript;
  const words = (source ?? "").trim();
  if (!words) return "(your voice note)";
  return words.length > 140 ? `${words.slice(0, 137)}…` : words;
}

export function buildReceiptBlocks(sounding: SoundingRow, item: SoundingItemRow): Blocks {
  const outcome =
    item.status === "integrated"
      ? `*what changed:* ${item.statusReason ?? "folded into the working draft."}`
      : `*where it landed:* ${item.statusReason}. still glad you flagged it.`;
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `🧾 *receipt* — your note on *${sounding.docTitle}*:\n` +
          `> "${itemExcerpt(item)}"\n` +
          outcome,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "just closing the loop — nothing needed from you." }],
    },
  ];
}

/** DM a reviewer the receipt for one triaged item. Returns whether it landed —
 *  the caller only marks receipt_sent_at on success. */
export async function sendReceiptDm(
  sounding: SoundingRow,
  item: SoundingItemRow,
): Promise<boolean> {
  const text = `receipt: your note on ${sounding.docTitle} — here's what happened with it`;
  const blocks = buildReceiptBlocks(sounding, item);
  if (item.slackUserId) return sendDm(item.slackUserId, text, blocks);
  if (item.reviewerEmail) return sendDmByEmail(item.reviewerEmail, text, blocks);
  return false;
}

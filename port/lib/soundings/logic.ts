/**
 * Soundings — pure lifecycle logic. No I/O anywhere in this file: everything
 * takes plain inputs and a `now` Date so it's all unit-testable
 * (lib/__tests__/soundings-*.test.ts).
 *
 * The design rules this module encodes (docs/soundings/build-brief.md):
 *   - deadlines are "next wednesday 9am PT" (whirlpool morning), DST-correct,
 *     rolling a week when created too close to the wire
 *   - ONE reminder max, only inside a narrow pre-deadline window, only to
 *     people who haven't responded — and never when the sounding was created
 *     so late a reminder would just be a nag
 *   - a 🙅 pass is a real response; silence past the deadline is consent
 *   - item terminal states are immutable
 */

import type { OnePager } from "@/lib/notion/types";
import type { SoundingQuestion, SoundingRow } from "@/lib/supabase/soundings";
import type { SoundingReviewerRow } from "@/lib/supabase/sounding-reviewers";
import type { SoundingItemRow, SoundingItemStatus } from "@/lib/supabase/sounding-items";

// ── time: wednesday 9am PT, DST-correct, no deps ─────────────────────────────

const PT_TZ = "America/Los_Angeles";
const WHIRLPOOL_HOUR_PT = 9; // whirlpools run wed 9–10:30am PT
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

interface PtParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun … 6=Sat
}

/** Wall-clock parts of a UTC instant, in Pacific time. */
function ptParts(atUtc: Date): PtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(atUtc)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // "24" for midnight in some ICU versions
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/**
 * UTC instant of a Pacific wall-clock time. Two-pass fixed-point: guess the
 * offset from an approximate instant, then re-derive it from the corrected
 * instant — converges across PST↔PDT boundaries without a tz database.
 */
function utcFromPtWallClock(year: number, month: number, day: number, hour: number): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour + 8)); // assume PST (UTC-8)
  for (let i = 0; i < 2; i++) {
    const p = ptParts(guess);
    const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, 0);
    guess = new Date(guess.getTime() + (targetAsUtc - wallAsUtc));
  }
  return guess;
}

/**
 * The next Wednesday 09:00 America/Los_Angeles as a UTC instant. If that
 * instant is less than `minLeadHours` away (default 24), roll to the
 * FOLLOWING Wednesday — a sounding opened Tuesday night shouldn't set a
 * deadline nobody can meaningfully meet.
 */
export function nextWhirlpoolDeadline(now: Date, minLeadHours = 24): Date {
  const today = ptParts(now);
  const daysUntilWed = (3 - today.weekday + 7) % 7;
  // Anchor on today's PT date, then walk forward in PT calendar days.
  let candidate = utcFromPtWallClock(today.year, today.month, today.day, WHIRLPOOL_HOUR_PT);
  candidate = addPtDays(candidate, daysUntilWed);
  while (candidate.getTime() - now.getTime() < minLeadHours * 3_600_000) {
    candidate = addPtDays(candidate, 7);
  }
  return candidate;
}

/** Advance a PT-wall-clock instant by whole PT calendar days (DST-safe). */
function addPtDays(atUtc: Date, days: number): Date {
  if (days === 0) return atUtc;
  const p = ptParts(atUtc);
  // Let Date.UTC normalize the day overflow, then re-resolve the PT offset.
  const rolled = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  const r = ptParts(new Date(rolled.getTime() + 12 * 3_600_000)); // midday, safely inside the target day
  return utcFromPtWallClock(r.year, r.month, r.day, p.hour);
}

// ── reminders: one max, narrow window, no late-created nags ──────────────────

export const REMINDER_WINDOW_HOURS = 24;
/** A reminder window that opens sooner than this after creation is suppressed
 *  entirely — the kickoff post IS the notification at that point. */
export const REMINDER_MIN_AGE_HOURS = 4;

export interface ReminderReviewerState {
  respondedAt: string | null;
  remindedAt: string | null;
}

export interface ReminderSoundingState {
  status: string;
  createdAt: string;
  deadlineAt: string;
}

/**
 * Pure eligibility for the ONE reminder: inside [deadline−24h, deadline),
 * sounding still open, reviewer silent, never reminded, and the window
 * didn't open on the heels of the kickoff itself. The DB-level
 * claimReminder() enforces once-EVER — this only decides "is now the moment".
 */
export function reminderEligible(
  reviewer: ReminderReviewerState,
  sounding: ReminderSoundingState,
  now: Date,
): boolean {
  if (sounding.status !== "open") return false;
  if (reviewer.respondedAt) return false;
  if (reviewer.remindedAt) return false;
  const deadline = new Date(sounding.deadlineAt).getTime();
  const windowStart = deadline - REMINDER_WINDOW_HOURS * 3_600_000;
  const created = new Date(sounding.createdAt).getTime();
  if (windowStart - created < REMINDER_MIN_AGE_HOURS * 3_600_000) return false;
  const t = now.getTime();
  return t >= windowStart && t < deadline;
}

// ── sweep decisions ──────────────────────────────────────────────────────────

export function allResponded(reviewers: Array<{ respondedAt: string | null }>): boolean {
  return reviewers.length > 0 && reviewers.every((r) => r.respondedAt !== null);
}

export type SweepAction = "digest" | "expire" | "none";

/**
 * What the sweep should do with an open sounding right now:
 *   - past deadline with ≥1 note (a pass counts — it's a response) → digest
 *   - past deadline with zero notes → expire, gracefully (silence = consent)
 *   - before deadline but EVERYONE has responded → digest early, don't make
 *     people wait for a deadline that no longer matters
 *   - otherwise → nothing
 */
export function sweepAction(
  sounding: { status: string; deadlineAt: string },
  reviewers: Array<{ respondedAt: string | null }>,
  itemCount: number,
  now: Date,
): SweepAction {
  if (sounding.status !== "open") return "none";
  const pastDeadline = now.getTime() >= new Date(sounding.deadlineAt).getTime();
  if (pastDeadline) return itemCount > 0 ? "digest" : "expire";
  if (allResponded(reviewers) && itemCount > 0) return "digest";
  return "none";
}

/** Digested soundings older than this are auto-closed (untriaged items expire
 *  quietly — the queue must never become a guilt archive). */
export const DIGESTED_GRACE_DAYS = 7;

export function shouldAutoClose(
  sounding: { status: string; digestedAt: string | null },
  now: Date,
): boolean {
  if (sounding.status !== "digested" || !sounding.digestedAt) return false;
  return (
    now.getTime() - new Date(sounding.digestedAt).getTime() >
    DIGESTED_GRACE_DAYS * 24 * 3_600_000
  );
}

// ── slack reply classification ───────────────────────────────────────────────

/** Below this many characters a text reply is treated as chatter, not feedback. */
export const MIN_TEXT_LENGTH = 8;

export interface SlackReplyFile {
  id: string;
  mimetype?: string;
  /** slack's own voice notes carry subtype "slack_audio" */
  subtype?: string;
  url_private_download?: string;
  name?: string;
}

export interface SlackReplyMessage {
  ts: string;
  user?: string;
  text?: string;
  bot_id?: string;
  subtype?: string;
  files?: SlackReplyFile[];
}

export type ReplyClassification =
  | { kind: "voice"; file: { id: string; mimetype: string; urlPrivateDownload: string; name?: string } }
  | { kind: "text"; text: string }
  | { kind: "ignore"; reason: string };

/**
 * Decide what a thread reply is. Voice = a file_share carrying an audio file
 * (slack voice notes are audio/mp4 with file subtype "slack_audio"); text = a
 * plain threaded message with a non-trivial body. Bot messages (including our
 * own kickoff/digest replies) are ignored — this guard matters on the cron
 * catch-up path too, where the events route's bot filter never ran.
 */
export function classifyThreadReply(msg: SlackReplyMessage): ReplyClassification {
  if (msg.bot_id) return { kind: "ignore", reason: "bot message" };
  if (!msg.user) return { kind: "ignore", reason: "no user" };

  const audio = (msg.files ?? []).find(
    (f) => f.mimetype?.startsWith("audio/") || f.subtype === "slack_audio",
  );
  if (audio) {
    if (!audio.url_private_download) return { kind: "ignore", reason: "audio file without download url" };
    return {
      kind: "voice",
      file: {
        id: audio.id,
        mimetype: audio.mimetype ?? "audio/mp4",
        urlPrivateDownload: audio.url_private_download,
        name: audio.name,
      },
    };
  }

  if ((msg.files ?? []).length > 0) return { kind: "ignore", reason: "non-audio file" };
  // file_share is the one subtype we admit (handled above); everything else —
  // message_changed, message_deleted, thread_broadcast bookkeeping — is noise.
  if (msg.subtype && msg.subtype !== "file_share") {
    return { kind: "ignore", reason: `subtype ${msg.subtype}` };
  }

  const text = (msg.text ?? "").trim();
  if (text.length < MIN_TEXT_LENGTH) return { kind: "ignore", reason: "text too short" };
  return { kind: "text", text };
}

/** 🙅 in its common emoji names — reacting with one on the sounding's root
 *  message records a penalty-free pass. */
export const PASS_REACTIONS = ["no_good", "woman-gesturing-no", "man-gesturing-no"] as const;

export function isPassReaction(name: string): boolean {
  return (PASS_REACTIONS as readonly string[]).includes(name);
}

// ── item state machine ───────────────────────────────────────────────────────

/** Only `new` items may transition; terminal states are immutable. */
export function canTransitionItem(from: SoundingItemStatus, to: SoundingItemStatus): boolean {
  if (from !== "new") return false;
  return to === "integrated" || to === "declined" || to === "expired";
}

// ── small pure helpers ───────────────────────────────────────────────────────

export function slackMessagePermalink(channelId: string, ts: string): string {
  return `https://slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
}

export function audioExtFromMime(mimetype: string): string {
  if (mimetype.includes("mp4")) return "m4a";
  if (mimetype.includes("mpeg") || mimetype.includes("mp3")) return "mp3";
  if (mimetype.includes("ogg")) return "ogg";
  if (mimetype.includes("wav")) return "wav";
  return "webm";
}

// ── agent question derivation (🤖 provenance) ────────────────────────────────

/**
 * Seed at most two 🤖 biz questions from the one-pager's open ends — the
 * things a human genuinely needs to weigh in on. No Claude call at create
 * time in phase 1; these are mechanical extractions with honest provenance.
 */
export function deriveAgentQuestions(onePager: OnePager | null): SoundingQuestion[] {
  if (!onePager) return [];
  const questions: SoundingQuestion[] = [];
  if (onePager.eligibility.verdict === "uncertain" && onePager.eligibility.note) {
    questions.push({
      text: `eligibility is uncertain — ${onePager.eligibility.note} does anyone read this differently?`,
      askedByType: "agent",
      askedByName: "biz",
    });
  }
  if (questions.length < 2 && onePager.itemsToVerify.length > 0) {
    questions.push({
      text: `before we commit: ${onePager.itemsToVerify[0]} — can anyone confirm or refute?`,
      askedByType: "agent",
      askedByName: "biz",
    });
  }
  if (questions.length < 2 && onePager.requiredConditions.length > 0) {
    questions.push({
      text: `the funder requires: ${onePager.requiredConditions[0]} — does that change our read?`,
      askedByType: "agent",
      askedByName: "biz",
    });
  }
  return questions.slice(0, 2);
}

// ── digest input assembly ────────────────────────────────────────────────────

/**
 * Deterministic prompt input for the digest call: numbered feedback notes
 * (transcript, text, or an honest "transcription failed" fallback with the
 * audio link), passes reported neutrally, non-responders reported as fine.
 * Nothing here frames response behaviour as a score — the digest is about the
 * DOCUMENT, not the people.
 */
export function assembleDigestInput(
  sounding: Pick<SoundingRow, "docTitle" | "docUrl" | "questions">,
  items: SoundingItemRow[],
  reviewers: SoundingReviewerRow[],
): string {
  const lines: string[] = [];
  lines.push(`document: ${sounding.docTitle}`);
  if (sounding.docUrl) lines.push(`link: ${sounding.docUrl}`);

  if (sounding.questions.length > 0) {
    lines.push("", "questions that were on the table:");
    for (const q of sounding.questions) {
      const icon = q.askedByType === "human" ? "👤" : "🤖";
      lines.push(`- ${icon} ${q.askedByName}: ${q.text}`);
    }
  }

  const notes = items.filter((i) => i.kind !== "pass");
  const passes = items.filter((i) => i.kind === "pass");

  lines.push("", `feedback notes (${notes.length}):`);
  let n = 0;
  for (const item of notes) {
    n += 1;
    const who = item.reviewerEmail ?? item.slackUserId;
    if (item.kind === "voice") {
      if (item.transcriptStatus === "done" && item.transcript) {
        lines.push(`${n}. [voice note — ${who}] ${item.transcript}`);
      } else {
        lines.push(
          `${n}. [voice note — ${who}] transcription failed — listen: ${item.audioR2Url ?? "audio unavailable"}`,
        );
      }
    } else {
      lines.push(`${n}. [text — ${who}] ${item.textBody ?? ""}`);
    }
  }
  if (notes.length === 0) lines.push("(none)");

  for (const p of passes) {
    lines.push(`- ${p.reviewerEmail ?? p.slackUserId}: responded — pass on this one`);
  }
  for (const r of reviewers) {
    if (!r.respondedAt) lines.push(`- ${r.email}: no response (that's fine)`);
  }

  return lines.join("\n");
}

/**
 * Soundings — the hourly lifecycle sweep (called by
 * /api/cron/soundings-sweep). Per open sounding, in order:
 *
 *   1. catch-up — re-walk the thread (conversations.replies) from the last
 *      captured reply and run anything Slack never delivered through the same
 *      idempotent capture pipeline as the events route
 *   2. transcript retries — pending/failed voice items get another shot
 *      (from R2 when archived, else a fresh slack download url)
 *   3. reminders — the ONE allowed nudge, individual DM only, atomically
 *      claimed; a DM failure after a won claim loses the reminder (we fail
 *      toward silence, never a double nudge)
 *   4. digest or graceful expiry, behind atomic open→digested / open→expired
 *      claims so overlapping runs can't double-post
 *
 * Then globally: repair digests that generated but never posted, send receipt
 * DMs for newly-triaged items, and auto-close digested soundings past the
 * grace window (untriaged items expire quietly — no guilt archive).
 */

import { getThreadReplies } from "@/lib/slack";
import {
  listOpenSoundings,
  listDigestedSoundings,
  getSoundingById,
  claimDigest,
  setDigestPosted,
  expireSounding,
  closeSounding,
  type SoundingRow,
} from "@/lib/supabase/soundings";
import { listReviewers, claimReminder } from "@/lib/supabase/sounding-reviewers";
import {
  listItems,
  latestItemTs,
  listPendingTranscripts,
  listReceiptDue,
  expireNewItems,
  markReceiptSent,
  setTranscript,
} from "@/lib/supabase/sounding-items";
import { getAssetBuffer } from "@/lib/r2/upload";
import { transcribeAudio } from "@/lib/transcribe/whisper";
import { reminderEligible, sweepAction, shouldAutoClose } from "./logic";
import { captureThreadReply, processVoiceItem } from "./capture";
import { generateSoundingDigest } from "./digest";
import {
  sendReminderDm,
  postSoundingDigest,
  postExpiryNote,
  sendReceiptDm,
} from "./slack";

export interface SweepResult {
  openSoundings: number;
  caughtUp: number;
  transcriptRetries: number;
  reminded: number;
  digested: string[];
  expired: string[];
  receipts: number;
  autoClosed: number;
  errors: string[];
}

export async function runSoundingsSweep(now: Date = new Date()): Promise<SweepResult> {
  const result: SweepResult = {
    openSoundings: 0,
    caughtUp: 0,
    transcriptRetries: 0,
    reminded: 0,
    digested: [],
    expired: [],
    receipts: 0,
    autoClosed: 0,
    errors: [],
  };

  const open = await listOpenSoundings();
  result.openSoundings = open.length;

  for (const sounding of open) {
    try {
      await catchUpThread(sounding, result);
      await retryTranscripts(sounding, result);
      await sendDueReminders(sounding, now, result);
      await settle(sounding, now, result);
    } catch (err) {
      result.errors.push(
        `${sounding.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  try {
    await repairUnpostedDigests(result);
  } catch (err) {
    result.errors.push(`repair: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    await sendDueReceipts(result);
  } catch (err) {
    result.errors.push(`receipts: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    await autoCloseDigested(now, result);
  } catch (err) {
    result.errors.push(`auto-close: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/** 1. Re-walk the thread for replies the events route never saw. */
async function catchUpThread(sounding: SoundingRow, result: SweepResult): Promise<void> {
  const oldest = (await latestItemTs(sounding.id)) ?? undefined;
  const replies = await getThreadReplies(sounding.slackChannelId, sounding.slackThreadTs, oldest);
  for (const reply of replies) {
    const outcome = await captureThreadReply(sounding, reply);
    if (outcome === "created") result.caughtUp += 1;
  }
}

/** 2. Give stuck voice notes another shot at transcription. */
async function retryTranscripts(sounding: SoundingRow, result: SweepResult): Promise<void> {
  const stuck = await listPendingTranscripts(sounding.id);
  if (stuck.length === 0) return;

  // Fresh download urls for items whose audio never reached R2 — slack file
  // urls are stable but re-reading the thread is the dependable way to get one.
  let urlByFileId: Map<string, string> | null = null;

  for (const item of stuck) {
    if (item.audioR2Key) {
      const audio = await getAssetBuffer(item.audioR2Key);
      if (!audio) continue;
      const r = await transcribeAudio(audio.buffer, item.audioContentType ?? audio.contentType);
      await setTranscript(item.id, {
        transcript: r.transcript || null,
        status: r.error || !r.transcript ? "failed" : "done",
        error: r.error ?? null,
      });
      result.transcriptRetries += 1;
      continue;
    }

    if (!item.slackFileId) continue;
    if (!urlByFileId) {
      urlByFileId = new Map();
      const replies = await getThreadReplies(sounding.slackChannelId, sounding.slackThreadTs);
      for (const reply of replies) {
        for (const f of reply.files ?? []) {
          if (f.url_private_download) urlByFileId.set(f.id, f.url_private_download);
        }
      }
    }
    const url = urlByFileId.get(item.slackFileId);
    if (!url) continue;
    await processVoiceItem(sounding, item, {
      id: item.slackFileId,
      mimetype: item.audioContentType ?? "audio/mp4",
      urlPrivateDownload: url,
    });
    result.transcriptRetries += 1;
  }
}

/** 3. The single allowed reminder, per silent reviewer, inside the window. */
async function sendDueReminders(
  sounding: SoundingRow,
  now: Date,
  result: SweepResult,
): Promise<void> {
  const reviewers = await listReviewers(sounding.id);
  for (const reviewer of reviewers) {
    if (!reminderEligible(reviewer, sounding, now)) continue;
    const won = await claimReminder(reviewer.id);
    if (!won) continue;
    const sent = await sendReminderDm(sounding, reviewer);
    if (sent) {
      result.reminded += 1;
    } else {
      // Claim already burned — deliberately accept the lost reminder rather
      // than risking a second nudge on a later run.
      console.warn(
        `[soundings/sweep] reminder DM failed for ${reviewer.email} on ${sounding.id} — not retrying (one-max)`,
      );
    }
  }
}

/** 4. Digest at the deadline (or early when everyone responded); expire gracefully. */
async function settle(sounding: SoundingRow, now: Date, result: SweepResult): Promise<void> {
  const reviewers = await listReviewers(sounding.id);
  const items = await listItems(sounding.id);
  const action = sweepAction(sounding, reviewers, items.length, now);

  if (action === "digest") {
    if (!(await claimDigest(sounding.id))) return; // someone else won — fine
    const digest = await generateSoundingDigest(sounding, items, reviewers);
    if (!digest) {
      // Claim stands; the repair pass below retries generation+post next run.
      await setDigestPosted(sounding.id, null, null);
      result.errors.push(`${sounding.id}: digest generation failed — queued for repair`);
      return;
    }
    const counts = {
      voice: items.filter((i) => i.kind === "voice").length,
      text: items.filter((i) => i.kind === "text").length,
      pass: items.filter((i) => i.kind === "pass").length,
    };
    const postedTs = await postSoundingDigest(sounding, digest, counts);
    await setDigestPosted(sounding.id, digest, postedTs);
    if (!postedTs) {
      result.errors.push(`${sounding.id}: digest post failed — queued for repair`);
      return;
    }
    result.digested.push(sounding.id);
  } else if (action === "expire") {
    if (!(await expireSounding(sounding.id))) return;
    await postExpiryNote(sounding);
    await expireNewItems(sounding.id); // vacuously empty, kept for invariant clarity
    result.expired.push(sounding.id);
  }
}

/** Digested-but-never-posted repair: regenerate if needed, then post. */
async function repairUnpostedDigests(result: SweepResult): Promise<void> {
  const digestedRows = await listDigestedSoundings();
  for (const sounding of digestedRows) {
    if (sounding.digestPostedTs) continue;
    const items = await listItems(sounding.id);
    const reviewers = await listReviewers(sounding.id);
    const digest =
      sounding.digestJson ?? (await generateSoundingDigest(sounding, items, reviewers));
    if (!digest) continue; // still failing — try again next run
    const counts = {
      voice: items.filter((i) => i.kind === "voice").length,
      text: items.filter((i) => i.kind === "text").length,
      pass: items.filter((i) => i.kind === "pass").length,
    };
    const postedTs = await postSoundingDigest(sounding, digest, counts);
    await setDigestPosted(sounding.id, digest, postedTs);
    if (postedTs) result.digested.push(sounding.id);
  }
}

/** Receipt DMs for newly-triaged items — the volunteer reward loop. */
async function sendDueReceipts(result: SweepResult): Promise<void> {
  const due = await listReceiptDue();
  if (due.length === 0) return;
  const soundingCache = new Map<string, SoundingRow | null>();
  for (const item of due) {
    let sounding = soundingCache.get(item.soundingId);
    if (sounding === undefined) {
      sounding = await getSoundingById(item.soundingId);
      soundingCache.set(item.soundingId, sounding);
    }
    if (!sounding) continue;
    const sent = await sendReceiptDm(sounding, item);
    if (sent) {
      await markReceiptSent(item.id); // only on success — a slack hiccup never loses a receipt
      result.receipts += 1;
    }
  }
}

/** Grace-window close: digested >7d → closed, untriaged items expire quietly. */
async function autoCloseDigested(now: Date, result: SweepResult): Promise<void> {
  const digestedRows = await listDigestedSoundings();
  for (const sounding of digestedRows) {
    if (!shouldAutoClose(sounding, now)) continue;
    if (await closeSounding(sounding.id)) {
      await expireNewItems(sounding.id);
      result.autoClosed += 1;
    }
  }
}

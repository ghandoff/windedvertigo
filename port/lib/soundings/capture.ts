/**
 * Soundings — reply capture. ONE pipeline shared by both entry points:
 *   - the Slack events route (app/api/agent/slack/events), inside after()
 *   - the hourly soundings-sweep cron's catch-up walk (conversations.replies)
 *
 * Idempotency is the whole game here: Slack delivers events at-least-once and
 * the sweep re-walks threads, so insertItem()'s claim-first upsert (unique on
 * sounding + user + msg ts, plus the slack_file_id partial unique) is done
 * BEFORE any slow work — whoever loses the claim simply stops.
 */

import { transcribeAudio } from "@/lib/transcribe/whisper";
import { uploadAsset } from "@/lib/r2/upload";
import { addReaction, downloadSlackFile, getSlackUserEmail } from "@/lib/slack";
import { getSoundingByThread, type SoundingRow } from "@/lib/supabase/soundings";
import { markResponded } from "@/lib/supabase/sounding-reviewers";
import {
  insertItem,
  setItemAudio,
  setTranscript,
  type SoundingItemRow,
} from "@/lib/supabase/sounding-items";
import {
  classifyThreadReply,
  isPassReaction,
  audioExtFromMime,
  type SlackReplyMessage,
} from "./logic";

/** ✅ — the quiet "got it, transcribed" ack on a captured reply. */
const CAPTURE_ACK_REACTION = "white_check_mark";

export type CaptureResult = "created" | "duplicate" | "ignored";

/**
 * Classify one thread reply and, for voice/text, claim + process it.
 * Voice: pending-item claim → download from slack → R2 → whisper → transcript.
 * A failed download/transcription leaves the item recoverable
 * (transcript_status pending/failed) for the sweep's retry pass.
 */
export async function captureThreadReply(
  sounding: SoundingRow,
  msg: SlackReplyMessage,
): Promise<CaptureResult> {
  const classified = classifyThreadReply(msg);
  if (classified.kind === "ignore") return "ignored";

  const reviewerEmail = msg.user ? await getSlackUserEmail(msg.user) : null;

  if (classified.kind === "text") {
    const { created } = await insertItem({
      soundingId: sounding.id,
      slackUserId: msg.user!,
      reviewerEmail,
      kind: "text",
      slackMsgTs: msg.ts,
      textBody: classified.text,
      transcriptStatus: "done",
    });
    if (!created) return "duplicate";
    await markResponded(sounding.id, { email: reviewerEmail, slackUserId: msg.user }, { passed: false });
    await addReaction(sounding.slackChannelId, msg.ts, CAPTURE_ACK_REACTION);
    return "created";
  }

  // voice — claim the item FIRST (pending), then do the slow work
  const { row, created } = await insertItem({
    soundingId: sounding.id,
    slackUserId: msg.user!,
    reviewerEmail,
    kind: "voice",
    slackMsgTs: msg.ts,
    slackFileId: classified.file.id,
    audioContentType: classified.file.mimetype,
    transcriptStatus: "pending",
  });
  if (!created || !row) return "duplicate";

  await processVoiceItem(sounding, row, classified.file);

  await markResponded(sounding.id, { email: reviewerEmail, slackUserId: msg.user }, { passed: false });
  return "created";
}

/**
 * Download → R2 → whisper for a claimed voice item. Shared with the sweep's
 * transcript-retry pass. Every failure path records an honest state on the
 * item instead of throwing.
 */
export async function processVoiceItem(
  sounding: SoundingRow,
  item: SoundingItemRow,
  file: { id: string; mimetype: string; urlPrivateDownload: string },
): Promise<void> {
  const downloaded = await downloadSlackFile(file.urlPrivateDownload);
  if (!downloaded) {
    // Leave as pending — the sweep re-derives a fresh download url from the
    // thread and retries; after that it degrades to failed-with-link.
    await setTranscript(item.id, { status: "failed", error: "slack file download failed" });
    return;
  }

  const contentType = file.mimetype || downloaded.contentType;
  const key = `soundings/${sounding.id}/${file.id}.${audioExtFromMime(contentType)}`;
  let r2Url: string | null = null;
  try {
    r2Url = await uploadAsset(downloaded.buffer, key, contentType);
    await setItemAudio(item.id, { r2Key: key, r2Url, contentType });
  } catch (err) {
    // Keep going — a transcript without an archived audio copy still feeds
    // the digest; the audio link fallback just won't be available.
    console.warn("[soundings/capture] R2 upload failed:", err instanceof Error ? err.message : err);
  }

  const result = await transcribeAudio(downloaded.buffer, contentType);
  if (result.error || !result.transcript) {
    await setTranscript(item.id, {
      status: "failed",
      error: result.error ?? "empty transcript",
    });
  } else {
    await setTranscript(item.id, { transcript: result.transcript, status: "done" });
  }

  await addReaction(sounding.slackChannelId, item.slackMsgTs, CAPTURE_ACK_REACTION);
}

/**
 * A 🙅 reaction on the sounding's ROOT message = a penalty-free pass.
 * Recorded as a real item + response; no DM, no noise, nothing owed.
 */
export async function capturePassReaction(
  sounding: SoundingRow,
  ev: { user: string; itemTs: string },
): Promise<CaptureResult> {
  if (ev.itemTs !== sounding.slackThreadTs) return "ignored"; // passes live on the root only

  const reviewerEmail = await getSlackUserEmail(ev.user);
  const { created } = await insertItem({
    soundingId: sounding.id,
    slackUserId: ev.user,
    reviewerEmail,
    kind: "pass",
    slackMsgTs: ev.itemTs,
    transcriptStatus: "done",
  });
  if (!created) return "duplicate";
  await markResponded(sounding.id, { email: reviewerEmail, slackUserId: ev.user }, { passed: true });
  return "created";
}

/** Minimal event shape the soundings branch needs from the events route. */
export interface SoundingsSlackEvent {
  type?: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
  ts?: string;
  thread_ts?: string;
  files?: Array<{
    id: string;
    mimetype?: string;
    subtype?: string;
    url_private_download?: string;
    name?: string;
  }>;
  reaction?: string;
  item?: { channel?: string; ts?: string };
}

/**
 * Events-route entry point. Cheap by design: a single indexed lookup on
 * (channel, thread_ts) decides whether this event belongs to a sounding at
 * all — every non-sounding thread no-ops right there. Runs inside after(),
 * never on the ack path. Never throws.
 */
export async function handleSoundingsEvent(ev: SoundingsSlackEvent): Promise<void> {
  try {
    if (ev.type === "reaction_added") {
      if (!ev.user || !ev.reaction || !ev.item?.channel || !ev.item?.ts) return;
      if (!isPassReaction(ev.reaction)) return;
      const sounding = await getSoundingByThread(ev.item.channel, ev.item.ts);
      if (!sounding || sounding.status !== "open") return;
      await capturePassReaction(sounding, { user: ev.user, itemTs: ev.item.ts });
      return;
    }

    if (ev.type === "message") {
      if (!ev.channel || !ev.thread_ts || !ev.ts) return;
      const sounding = await getSoundingByThread(ev.channel, ev.thread_ts);
      if (!sounding || sounding.status !== "open") return;
      await captureThreadReply(sounding, {
        ts: ev.ts,
        user: ev.user,
        text: ev.text,
        bot_id: ev.bot_id,
        subtype: ev.subtype,
        files: ev.files,
      });
    }
  } catch (err) {
    console.warn("[soundings/capture] handleSoundingsEvent failed:", err instanceof Error ? err.message : err);
  }
}

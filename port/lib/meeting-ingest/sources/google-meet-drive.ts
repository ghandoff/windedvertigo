/**
 * Meet AI transcript ingest — Google Drive source.
 *
 * Pulls new "Notes by Gemini" / "Transcript" Google Docs from a configured
 * Drive folder (Meet Recordings), parses out the meeting metadata + body
 * text, matches each Doc to a pending Council meeting row by gcal_event_id
 * (via Drive properties when present, falling back to title+time heuristic),
 * then calls writeMeetingToSupabase to merge action items + summary into the
 * existing pending row from gcal-sync.
 *
 * Doc title shapes Meet emits (covering recent format changes):
 *   "<meeting title> - YYYY/MM/DD HH:MM GMT+N - Notes by Gemini"
 *   "<meeting title> (YYYY-MM-DD) - Transcript"
 *   "<meeting title> - Meeting transcript"
 *
 * Idempotency: each Doc id gets persisted to meetings.transcript_doc_id on
 * first ingest. Subsequent cron runs skip Docs already-seen.
 */

import { listFilesInFolder, exportDocAsText, type DriveFile } from "@/lib/gdrive";
import { extractMeetingActions } from "@/lib/ai/meeting-actions";
import { writeMeetingToSupabase } from "../ingest-to-supabase";
import { hasMeetingForTranscriptDoc, listUpcomingMeetings, listRecentMeetings } from "@/lib/supabase/meetings";
import type { Meeting } from "@/lib/supabase/meetings";

export interface MeetIngestOptions {
  folderId: string;
  /**
   * ISO timestamp — only process docs modified after this time. Defaults
   * to last 25 hours to give the hourly cron a generous overlap and
   * survive a missed run.
   */
  sinceIso?: string;
  /** Cap how many docs we process per run. Safety against runaway. */
  maxDocs?: number;
  /**
   * Impersonate a specific Workspace user for this ingest run. Defaults to
   * the env-configured subject. Multi-member crons pass each member's
   * email so the SA reads that member's Drive (their Meet AI transcripts).
   */
  subject?: string;
}

export interface MeetIngestResult {
  scanned: number;
  ingested: number;
  skippedAlreadySeen: number;
  skippedNoMatch: number;
  errors: string[];
}

// ── Drive properties — Meet sets these on transcript Docs sometimes ──
// The exact field names have evolved. We probe a few known keys.
const GCAL_EVENT_ID_PROPERTY_KEYS = [
  "calendarEventId",
  "eventId",
  "meet:eventId",
];

function extractGcalIdFromProperties(file: DriveFile): string | null {
  if (!file.properties) return null;
  for (const key of GCAL_EVENT_ID_PROPERTY_KEYS) {
    if (file.properties[key]) return file.properties[key];
  }
  return null;
}

/**
 * Strip Meet-emitted suffixes to get the bare meeting name. Conservative —
 * keep the actual title; drop only the date/time/format trailer.
 */
function cleanMeetTitle(rawName: string): string {
  return rawName
    .replace(/\s*-\s*Notes by Gemini\s*$/i, "")
    .replace(/\s*-\s*Meeting transcript\s*$/i, "")
    .replace(/\s*-\s*Transcript\s*$/i, "")
    // Strip ` - YYYY/MM/DD HH:MM TZ` trailer
    .replace(/\s*-\s*\d{4}[/-]\d{2}[/-]\d{2}\s+\d{1,2}:\d{2}\s+[A-Z+\d-]+\s*$/i, "")
    .replace(/\s*-\s*\d{4}[/-]\d{2}[/-]\d{2}\s*$/, "")
    .trim() || rawName;
}

/**
 * Parse "YYYY/MM/DD HH:MM TZ" out of a Meet AI Doc title and return an ISO
 * timestamp. Returns null if the pattern doesn't match — caller falls back
 * to file.modifiedTime (≈15min after the meeting ended).
 *
 * Note: the timezone in Meet's title is the recording user's TZ at meeting
 * time (e.g., PDT, EEST). We parse with that TZ when possible; fallback to
 * UTC. Best-effort — the gcal merge will overwrite started_at with the real
 * event time anyway when a gcal_event_id match succeeds.
 */
function parseMeetTitleTimestamp(rawName: string): string | null {
  const m = rawName.match(
    /-\s*(\d{4})[/-](\d{2})[/-](\d{2})\s+(\d{1,2}):(\d{2})\s+([A-Z+\d-]+)/i,
  );
  if (!m) return null;
  const [, yyyy, mm, dd, hh, mi /* tz */] = m;
  // Construct a UTC-ish ISO and let downstream compare loosely. The TZ
  // abbreviation handling is non-trivial in pure JS — defer to gcal merge
  // for precise start_at, fall back to local-time UTC here.
  const iso = `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${mi}:00Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Heuristic title/time matcher used when the Drive Doc doesn't expose a
 * calendarEventId property. Looks at meetings in a ±24h window of the
 * Doc's modifiedTime and matches by case-insensitive title substring.
 */
async function findMatchingMeetingByHeuristic(
  docTitle: string,
  docModifiedIso: string,
): Promise<Meeting | null> {
  // Strip Meet's title decorations to get the meeting name. Conservative —
  // we want a substring that's stable across the Meet variants.
  const cleanedTitle = docTitle
    .replace(/-\s*Notes by Gemini.*$/i, "")
    .replace(/-\s*Meeting transcript.*$/i, "")
    .replace(/-\s*Transcript.*$/i, "")
    .replace(/\(\d{4}[-/]\d{2}[-/]\d{2}.*\).*$/, "")
    .replace(/\s*-\s*\d{4}[/-]\d{2}[/-]\d{2}.*$/, "")
    .trim()
    .toLowerCase();
  if (!cleanedTitle) return null;

  // Search a ±24h window around the Doc's modification time. Meet usually
  // emits the transcript within ~10min of the meeting ending; 24h covers
  // every reasonable race condition.
  const [upcoming, recent] = await Promise.all([
    listUpcomingMeetings(50, 2).catch(() => [] as Meeting[]),
    listRecentMeetings(50).catch(() => [] as Meeting[]),
  ]);
  const candidates = [...upcoming, ...recent].filter((m) => {
    if (!m.startedAt) return false;
    const delta = Math.abs(new Date(m.startedAt).getTime() - new Date(docModifiedIso).getTime());
    return delta < 24 * 60 * 60 * 1000;
  });

  // Prefer exact substring match; fall back to fuzzy first-word match.
  const exact = candidates.find((m) => m.title.toLowerCase().includes(cleanedTitle));
  if (exact) return exact;

  const firstWord = cleanedTitle.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) {
    return candidates.find((m) => m.title.toLowerCase().includes(firstWord)) ?? null;
  }
  return null;
}

/**
 * Process a single Drive Doc → write to Supabase via writeMeetingToSupabase
 * (which merges into existing gcal-sync-created pending rows).
 *
 * Returns the meeting id on success, null on skip/error. Per-doc errors
 * are recorded in the parent result; this helper never throws.
 */
async function ingestOneTranscript(
  file: DriveFile,
  userIdForUsageTracking: string,
  subjectForDocFetch?: string,
): Promise<{ status: "ingested" | "skipped_no_match" | "error"; meetingId?: string; error?: string }> {
  // Pull the transcript text (impersonating the owner so Drive grants read).
  const text = await exportDocAsText(file.id, { subject: subjectForDocFetch });
  if (!text || text.length < 100) {
    return { status: "error", error: `Doc ${file.id} had no extractable text (length=${text?.length ?? 0})` };
  }

  // Find the gcal_event_id this Doc belongs to (best-effort; not required).
  let gcalEventId = extractGcalIdFromProperties(file);
  if (!gcalEventId) {
    const match = await findMatchingMeetingByHeuristic(file.name, file.modifiedTime);
    gcalEventId = match?.gcalEventId ?? null;
  }
  // No-match fallback: don't skip — create an unlinked meeting row. The
  // transcript still has real action items + a summary worth persisting.
  // Common cases that hit this path:
  //   - Past meetings before gcal-sync started populating pending records
  //   - Ad-hoc "take notes with Gemini" sessions without a calendar event
  //   - Calendar events not in the gcal-sync 7-day forward window
  // When gcalEventId is null, writeMeetingToSupabase falls through to INSERT
  // mode rather than UPDATE.

  // Run the Claude action extractor — this returns { actions, meetingSummary }.
  let extraction;
  try {
    // Truncate very long transcripts; extractMeetingActions handles short text fine.
    const truncated = text.slice(0, 24_000);
    extraction = await extractMeetingActions(truncated, userIdForUsageTracking);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", error: `extractMeetingActions for ${file.id}: ${msg}` };
  }

  // Parse the dated suffix from the title so the meeting's started_at reflects
  // the actual meeting time, not the doc creation time (which lags by ~15min).
  // Title shape: "<name> - YYYY/MM/DD HH:MM TZ - Notes by Gemini"
  const parsedStart = parseMeetTitleTimestamp(file.name) ?? file.modifiedTime;

  // Write — merges by gcal_event_id when present, otherwise inserts new row.
  // owner_email = the impersonated subject (whose Drive we read this from).
  // Critical for the privacy/visibility system: meetings ingested from
  // Maria's Drive get owner_email=maria@, so she can flip them to private
  // without Garrett losing access to ones from his own Drive.
  const result = await writeMeetingToSupabase(
    {
      title:           cleanMeetTitle(file.name),
      capturedVia:     "google-meet",
      startedAt:       parsedStart,
      gcalEventId:     gcalEventId ?? undefined,
      transcriptDocId: file.id,
      ownerEmail:      subjectForDocFetch,
    },
    extraction,
  );

  if (result.meetingId) return { status: "ingested", meetingId: result.meetingId };
  return { status: "error", error: result.errors.join("; ") || "writeMeetingToSupabase returned null" };
}

/**
 * Main entry — iterate recent Meet transcript Docs, ingest each one.
 *
 * Caller (the cron route) passes the folder id and an optional sinceIso.
 */
export async function ingestRecentMeetTranscripts(
  opts: MeetIngestOptions,
): Promise<MeetIngestResult> {
  const sinceIso =
    opts.sinceIso ?? new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const maxDocs = opts.maxDocs ?? 25;

  const files = await listFilesInFolder(opts.folderId, {
    modifiedSinceIso: sinceIso,
    // Both wording variants Meet has used recently. Without a name filter we'd
    // also pick up recording video files; this keeps us to text artifacts.
    nameContains: "Notes by Gemini",
    limit: maxDocs,
    subject: opts.subject,
  });

  if (files === null) {
    return {
      scanned: 0,
      ingested: 0,
      skippedAlreadySeen: 0,
      skippedNoMatch: 0,
      errors: ["listFilesInFolder returned null — likely missing Drive scope on DWD"],
    };
  }

  // If the "Notes by Gemini" filter returns nothing, try a broader filter as a
  // fallback. Meet's filename format has churned more than once.
  const docs =
    files.length > 0
      ? files
      : (await listFilesInFolder(opts.folderId, {
          modifiedSinceIso: sinceIso,
          nameContains: "Transcript",
          limit: maxDocs,
          subject: opts.subject,
        })) ?? [];

  const result: MeetIngestResult = {
    scanned: docs.length,
    ingested: 0,
    skippedAlreadySeen: 0,
    skippedNoMatch: 0,
    errors: [],
  };

  for (const file of docs) {
    // Idempotency — skip already-processed Docs.
    if (await hasMeetingForTranscriptDoc(file.id)) {
      result.skippedAlreadySeen++;
      continue;
    }
    try {
      const outcome = await ingestOneTranscript(file, "meet-ingest-cron", opts.subject);
      if (outcome.status === "ingested") result.ingested++;
      else if (outcome.status === "skipped_no_match") {
        result.skippedNoMatch++;
        if (outcome.error) result.errors.push(outcome.error);
      } else {
        if (outcome.error) result.errors.push(outcome.error);
      }
    } catch (err) {
      result.errors.push(
        `unexpected error ingesting ${file.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

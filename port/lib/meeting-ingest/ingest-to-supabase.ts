/**
 * Council ingest writer (W1) — Supabase destination.
 *
 * Sibling of lib/meeting-ingest/ingest-meeting-notes.ts (which writes to
 * Notion work_items). This module takes the same shape — meeting text + a
 * source identifier — and produces a meetings row + meeting_action_items
 * rows in Supabase. Optionally saves the raw transcript.
 *
 * During the parallel-trial period (~2 weeks per the W1 plan), both
 * ingest paths run side-by-side. After the trial, the Notion path retires
 * and this becomes the only writer.
 *
 * Owner resolution: extractMeetingActions returns first-name strings for
 * the `owner` field. We resolve those to email by matching against the
 * active members list — case-insensitive first-name match. Unresolved
 * owners get NULL email + the raw name preserved in owner_name.
 */

import { extractMeetingActions, type ExtractedAction } from "@/lib/ai/meeting-actions";
import { getActiveMembersFromSupabase } from "@/lib/supabase/members";
import { createMeeting, type CapturedVia } from "@/lib/supabase/meetings";
import { createActionItems, type CreateActionInput } from "@/lib/supabase/meeting-action-items";
import { createTranscript, type TranscriptSegment } from "@/lib/supabase/meeting-transcripts";

export interface IngestToSupabaseInput {
  title: string;
  /** Full meeting notes / transcript as text — fed to extractMeetingActions. */
  notes: string;
  capturedVia: CapturedVia;
  /** ISO timestamp; defaults to now. */
  startedAt?: string;
  endedAt?: string;
  organizerEmail?: string;
  attendeeEmails?: string[];
  gcalEventId?: string;
  /**
   * Source Drive Doc id (Meet AI transcripts only). Persists to
   * meetings.transcript_doc_id for idempotency on cron re-runs.
   */
  transcriptDocId?: string;
  /**
   * Team member whose Drive / session this came from. Used by the
   * privacy/visibility system — only the owner can flip a meeting to
   * 'private'. NULL preserves shared-team default.
   */
  ownerEmail?: string;
  /** Council visibility — 'shared' (team) or 'private' (owner-only). */
  visibility?: "shared" | "private";
  /** User id used for token-usage tracking inside callClaude. */
  userId: string;
  /** When the source provided structured segments, save them as a transcript row. */
  transcriptSegments?: TranscriptSegment[];
}

export interface IngestToSupabaseResult {
  meetingId: string | null;
  actionsCreated: number;
  transcriptSaved: boolean;
  errors: string[];
  summary?: string;
}

/** Build a case-insensitive first-name → email map from active members. */
async function buildOwnerMap(): Promise<Map<string, { email: string; name: string }>> {
  const members = await getActiveMembersFromSupabase().catch(() => []);
  const map = new Map<string, { email: string; name: string }>();
  for (const m of members) {
    if (!m.email || !m.name) continue;
    const first = m.name.split(/\s+/)[0]?.toLowerCase();
    if (first) map.set(first, { email: m.email.toLowerCase(), name: m.name });
  }
  return map;
}

function resolveOwner(
  rawOwner: string,
  ownerMap: Map<string, { email: string; name: string }>,
): { ownerEmail: string | null; ownerName: string } {
  const key = rawOwner.trim().toLowerCase();
  const match = ownerMap.get(key);
  if (match) return { ownerEmail: match.email, ownerName: match.name };
  return { ownerEmail: null, ownerName: rawOwner };
}

function mapActionToInput(
  meetingId: string,
  action: ExtractedAction,
  ownerMap: Map<string, { email: string; name: string }>,
): CreateActionInput {
  const { ownerEmail, ownerName } = resolveOwner(action.owner, ownerMap);
  return {
    meetingId,
    title:      action.title,
    ownerEmail,
    ownerName,
    deadline:   action.deadline,
    priority:   action.priority,
    type:       action.type,
    context:    action.context,
  };
}

/**
 * Lower-level write — used when the caller already has extracted data (e.g.
 * the Notion cron's ingestMeetingNotes() doesn't need to re-extract). Skip
 * the extraction step + just persist.
 */
export interface PreExtracted {
  actions: ExtractedAction[];
  meetingSummary: string;
}

export async function writeMeetingToSupabase(
  input: Omit<IngestToSupabaseInput, "notes" | "userId">,
  extraction: PreExtracted,
): Promise<IngestToSupabaseResult> {
  const errors: string[] = [];

  // Step 1: create the meetings row.
  const meetingId = await createMeeting({
    title:           input.title,
    capturedVia:     input.capturedVia,
    summary:         extraction.meetingSummary,
    startedAt:       input.startedAt ?? new Date().toISOString(),
    endedAt:         input.endedAt ?? null,
    organizerEmail:  input.organizerEmail ?? null,
    attendeeEmails:  input.attendeeEmails ?? [],
    gcalEventId:      input.gcalEventId ?? null,
    transcriptDocId:  input.transcriptDocId ?? null,
    ownerEmail:       input.ownerEmail ?? null,
    visibility:       input.visibility ?? "shared",
  });

  if (!meetingId) {
    errors.push("createMeeting returned null");
    return {
      meetingId: null,
      actionsCreated: 0,
      transcriptSaved: false,
      errors,
      summary: extraction.meetingSummary,
    };
  }

  // Step 2: bulk-insert action items with resolved owners.
  const ownerMap = await buildOwnerMap();
  const actionInputs = extraction.actions.map((a) =>
    mapActionToInput(meetingId, a, ownerMap),
  );
  const actionsCreated = await createActionItems(actionInputs);
  if (actionsCreated !== actionInputs.length) {
    errors.push(
      `createActionItems wrote ${actionsCreated}/${actionInputs.length} rows`,
    );
  }

  // Step 3: optionally save the transcript segments.
  let transcriptSaved = false;
  if (input.transcriptSegments && input.transcriptSegments.length > 0) {
    const tid = await createTranscript(meetingId, input.transcriptSegments);
    transcriptSaved = !!tid;
    if (!tid) errors.push("createTranscript returned null");
  }

  return {
    meetingId,
    actionsCreated,
    transcriptSaved,
    errors,
    summary: extraction.meetingSummary,
  };
}

/**
 * High-level ingest — calls extractMeetingActions then writes. Use when the
 * caller has raw transcript/notes text and needs the full pipeline.
 */
export async function ingestToSupabase(
  input: IngestToSupabaseInput,
): Promise<IngestToSupabaseResult> {
  // Step 1: extract actions + summary via Claude.
  let extraction;
  try {
    extraction = await extractMeetingActions(input.notes, input.userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      meetingId: null,
      actionsCreated: 0,
      transcriptSaved: false,
      errors: [`extractMeetingActions: ${msg}`],
    };
  }

  return writeMeetingToSupabase(input, extraction);
}

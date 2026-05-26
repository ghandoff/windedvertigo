/**
 * Supabase read/write for the `meetings` table (Council W1).
 *
 * One row per captured meeting from any source surface (in-browser
 * /transcribe, Google Meet, Plaud, Recall, manual). Action items + decisions
 * + transcripts FK back to this table.
 */

import { supabase } from "./client";

export type CapturedVia =
  | "in-browser"
  | "google-meet"
  | "plaud"
  | "recall"
  | "manual"
  | "notion-legacy";

export type MeetingVisibility = "shared" | "private";

export interface Meeting {
  id: string;
  createdAt: string;
  updatedAt: string;
  gcalEventId: string | null;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  capturedVia: CapturedVia;
  summary: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  /** 'shared' (team-visible, default) or 'private' (only owner sees). */
  visibility: MeetingVisibility;
  /** Member who ingested this meeting. Required to enforce visibility=private. */
  ownerEmail: string | null;
}

interface MeetingRow {
  id: string;
  created_at: string;
  updated_at: string;
  gcal_event_id: string | null;
  title: string;
  started_at: string | null;
  ended_at: string | null;
  captured_via: CapturedVia;
  summary: string | null;
  organizer_email: string | null;
  attendee_emails: string[] | null;
  visibility: MeetingVisibility | null;
  owner_email: string | null;
}

function mapRowToMeeting(row: MeetingRow): Meeting {
  return {
    id:              row.id,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    gcalEventId:     row.gcal_event_id,
    title:           row.title,
    startedAt:       row.started_at,
    endedAt:         row.ended_at,
    capturedVia:     row.captured_via,
    summary:         row.summary,
    organizerEmail:  row.organizer_email,
    attendeeEmails:  row.attendee_emails ?? [],
    visibility:      (row.visibility ?? "shared") as MeetingVisibility,
    ownerEmail:      row.owner_email,
  };
}

/**
 * Visibility filter to apply on every read that exposes meeting data.
 *
 * `filter`:
 *   - "all" (default) → shared rows + private rows owned by viewer
 *   - "team" → only shared rows (hide all privates, even my own)
 *   - "private" → only private rows owned by viewer
 *
 * `viewerEmail` is the lowercased viewer's email. Null means treat as
 * unauthenticated — collapses to shared-only regardless of `filter`.
 *
 * Returns a PostgREST `.or()` filter string. Reused across listRecent /
 * listUpcoming / search / wv-claw queries.
 */
export type VisibilityFilterMode = "all" | "team" | "private";

function visibilityFilter(
  viewerEmail: string | null,
  filter: VisibilityFilterMode = "all",
): string {
  if (!viewerEmail) return "visibility.eq.shared";
  if (filter === "team") return "visibility.eq.shared";
  if (filter === "private") {
    return `and(visibility.eq.private,owner_email.eq.${viewerEmail})`;
  }
  // "all" — shared OR (private AND owner is me)
  return `visibility.eq.shared,and(visibility.eq.private,owner_email.eq.${viewerEmail})`;
}

export interface CreateMeetingInput {
  title: string;
  capturedVia: CapturedVia;
  summary?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  organizerEmail?: string | null;
  attendeeEmails?: string[];
  gcalEventId?: string | null;
  /**
   * Source identifier for idempotency on transcript ingest. Currently only
   * set by the Meet AI Drive ingest cron — Drive Doc id of the transcript
   * that fed this meeting. Allows the cron to skip already-processed docs.
   */
  transcriptDocId?: string | null;
  /** 'shared' (default) or 'private'. */
  visibility?: MeetingVisibility;
  /** Team member who ingested this meeting. */
  ownerEmail?: string | null;
}

/**
 * Create a new meeting row OR merge into an existing pending row from a
 * prior gcal-sync pass. When gcalEventId is provided AND a row already
 * exists with that id, this UPDATE's the existing row with the new fields
 * (summary, captured_via, attendees, etc.) so we don't end up with two
 * records per real meeting. Returns the meeting id either way.
 */
export async function createMeeting(input: CreateMeetingInput): Promise<string | null> {
  try {
    // W4 merge: if a pending row from gcal-sync already exists, update it.
    if (input.gcalEventId) {
      const existing = await getMeetingByGcalEventId(input.gcalEventId);
      if (existing) {
        const { error: updateError } = await supabase
          .from("meetings")
          .update({
            // Prefer the new data when present, fall back to existing.
            title:              input.title || existing.title,
            captured_via:       input.capturedVia,
            summary:            input.summary ?? existing.summary,
            started_at:         input.startedAt ?? existing.startedAt,
            ended_at:           input.endedAt ?? existing.endedAt,
            organizer_email:    input.organizerEmail ?? existing.organizerEmail,
            attendee_emails:    input.attendeeEmails ?? existing.attendeeEmails,
            transcript_doc_id:  input.transcriptDocId ?? null,
            updated_at:         new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updateError) {
          console.warn("[supabase/meetings] merge update failed:", updateError.message);
          return null;
        }
        return existing.id;
      }
    }

    const { data, error } = await supabase
      .from("meetings")
      .insert({
        title:              input.title,
        captured_via:       input.capturedVia,
        summary:            input.summary ?? null,
        started_at:         input.startedAt ?? null,
        ended_at:           input.endedAt ?? null,
        organizer_email:    input.organizerEmail ?? null,
        attendee_emails:    input.attendeeEmails ?? [],
        gcal_event_id:      input.gcalEventId ?? null,
        transcript_doc_id:  input.transcriptDocId ?? null,
        visibility:         input.visibility ?? "shared",
        owner_email:        input.ownerEmail ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[supabase/meetings] create failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn("[supabase/meetings] create threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch the N most recent PAST meetings, newest first.
 *
 * Filters to `started_at < NOW()` so the "Recent" tab in /council shows
 * actual recent activity, not the upcoming-week records that gcal-sync
 * pre-creates. Use listUpcomingMeetings for the forward-looking view.
 */
export async function listRecentMeetings(
  limit = 25,
  viewerEmail: string | null = null,
  visibilityMode: VisibilityFilterMode = "all",
): Promise<Meeting[]> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .lt("started_at", nowIso)
      .or(visibilityFilter(viewerEmail, visibilityMode))
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.warn("[supabase/meetings] list-recent failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRowToMeeting(r as MeetingRow));
  } catch (err) {
    console.warn("[supabase/meetings] list-recent threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fetch upcoming meetings, soonest first.
 *
 * Bounded both by limit and by `daysAhead` so the view doesn't unintentionally
 * surface every event the GCal sync ever pre-created. Default 7 days = the
 * gcal-sync's own forward window, which keeps the UI consistent with what's
 * actually populated.
 */
export async function listUpcomingMeetings(
  limit = 25,
  daysAhead = 7,
  viewerEmail: string | null = null,
  visibilityMode: VisibilityFilterMode = "all",
): Promise<Meeting[]> {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .gte("started_at", now.toISOString())
      .lte("started_at", horizon.toISOString())
      .or(visibilityFilter(viewerEmail, visibilityMode))
      .order("started_at", { ascending: true })
      .limit(limit);
    if (error) {
      console.warn("[supabase/meetings] list-upcoming failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRowToMeeting(r as MeetingRow));
  } catch (err) {
    console.warn("[supabase/meetings] list-upcoming threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Lookup by GCal event id — used by the W4 pre-create → ingest matching path. */
export async function getMeetingByGcalEventId(gcalEventId: string): Promise<Meeting | null> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("gcal_event_id", gcalEventId)
      .maybeSingle();
    if (error) {
      console.warn("[supabase/meetings] gcal lookup failed:", error.message);
      return null;
    }
    return data ? mapRowToMeeting(data as MeetingRow) : null;
  } catch (err) {
    console.warn("[supabase/meetings] gcal lookup threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * W4 GCal flow: pre-create a pending Council meeting record from a GCal
 * event. Idempotent — if a meeting already exists with this gcalEventId,
 * returns its id without inserting. Used by the gcal-sync cron.
 *
 * Pending rows have captured_via='google-meet' (the most likely later
 * capture surface) but no summary yet — that lands when transcript
 * ingest fires and the matching gcalEventId is found.
 */
export async function upsertPendingMeetingFromGcal(input: {
  gcalEventId: string;
  title: string;
  startedAt?: string | null;
  endedAt?: string | null;
  organizerEmail?: string | null;
  attendeeEmails?: string[];
  /**
   * GCal-derived visibility. When the source event is marked private/
   * confidential in Google Calendar, we mirror that into Council so the
   * row is auto-protected at pre-creation time (no manual flip needed).
   * Defaults to 'shared' when omitted.
   */
  visibility?: "shared" | "private";
  /**
   * Owner email — set when visibility=private so the private-visibility
   * filter knows which user can see the row. Typically the calendar
   * subject the sync impersonated.
   */
  ownerEmail?: string | null;
}): Promise<{ id: string; isNew: boolean } | null> {
  try {
    // Check first (cheap, indexed).
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("gcal_event_id", input.gcalEventId)
      .maybeSingle();
    if (existing?.id) {
      return { id: existing.id, isNew: false };
    }
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        title:           input.title,
        captured_via:    "google-meet",
        gcal_event_id:   input.gcalEventId,
        started_at:      input.startedAt ?? null,
        ended_at:        input.endedAt ?? null,
        organizer_email: input.organizerEmail ?? null,
        attendee_emails: input.attendeeEmails ?? [],
        visibility:      input.visibility ?? "shared",
        owner_email:     input.ownerEmail ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[supabase/meetings] upsertPendingFromGcal failed:", error.message);
      return null;
    }
    return data?.id ? { id: data.id, isNew: true } : null;
  } catch (err) {
    console.warn(
      "[supabase/meetings] upsertPendingFromGcal threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Plain-text search over meetings.title + meetings.summary. Returns up to
 * `limit` newest matches. Case-insensitive. Doesn't search transcripts or
 * action items here — those are joined in the page-level search composer.
 */
export async function searchMeetings(
  query: string,
  limit = 25,
  viewerEmail: string | null = null,
): Promise<Meeting[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    // Two filters: visibility (always applied) AND text match (this query).
    // PostgREST supports chaining .or() but applies them as AND between calls.
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .or(visibilityFilter(viewerEmail))
      .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.warn("[supabase/meetings] search failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRowToMeeting(r as MeetingRow));
  } catch (err) {
    console.warn(
      "[supabase/meetings] search threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Idempotency check for the Meet AI transcript ingest cron. Returns true
 * if any meeting row already has this Drive Doc id recorded — meaning the
 * transcript was already processed. Fail-open returns false on error.
 */
export async function hasMeetingForTranscriptDoc(transcriptDocId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("id")
      .eq("transcript_doc_id", transcriptDocId)
      .limit(1);
    if (error) {
      console.warn("[supabase/meetings] hasMeetingForTranscriptDoc failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn(
      "[supabase/meetings] hasMeetingForTranscriptDoc threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Toggle a meeting's visibility (shared ↔ private). Caller is responsible
 * for authorization — typically only the owner_email can flip their own
 * meetings, but the API route enforces that, not this function.
 */
export async function updateMeetingVisibility(
  id: string,
  visibility: MeetingVisibility,
  ownerEmail?: string | null,
): Promise<boolean> {
  try {
    const patch: Record<string, unknown> = {
      visibility,
      updated_at: new Date().toISOString(),
    };
    // Set owner_email when transitioning to private (if not already set).
    if (visibility === "private" && ownerEmail) {
      patch.owner_email = ownerEmail;
    }
    const { error } = await supabase.from("meetings").update(patch).eq("id", id);
    if (error) {
      console.warn("[supabase/meetings] updateVisibility failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "[supabase/meetings] updateVisibility threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** Fetch one meeting by id. */
export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[supabase/meetings] get failed:", error.message);
      return null;
    }
    return data ? mapRowToMeeting(data as MeetingRow) : null;
  } catch (err) {
    console.warn("[supabase/meetings] get threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

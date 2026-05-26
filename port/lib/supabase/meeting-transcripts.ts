/**
 * Supabase read/write for `meeting_transcripts` (Council W1).
 *
 * Segments stored as JSONB:
 *   [{ ts: "00:01:23" | seconds, speaker: "lamis", text: "…" }]
 *
 * Read pattern: "warm blanket" — rarely the primary content, but reached
 * for when the summary leaves a question unanswered. Search is plain-text
 * for now; pgvector deferred until demand emerges.
 */

import { supabase } from "./client";

export interface TranscriptSegment {
  ts: number | string;
  speaker?: string;
  text: string;
}

export interface MeetingTranscript {
  id: string;
  meetingId: string;
  createdAt: string;
  segments: TranscriptSegment[];
}

interface TranscriptRow {
  id: string;
  meeting_id: string;
  created_at: string;
  segments: TranscriptSegment[] | null;
}

function mapRow(row: TranscriptRow): MeetingTranscript {
  return {
    id:         row.id,
    meetingId:  row.meeting_id,
    createdAt:  row.created_at,
    segments:   row.segments ?? [],
  };
}

/** Save a transcript for a meeting. Returns id on success, null on failure. */
export async function createTranscript(
  meetingId: string,
  segments: TranscriptSegment[],
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("meeting_transcripts")
      .insert({ meeting_id: meetingId, segments })
      .select("id")
      .single();
    if (error) {
      console.warn("[supabase/meeting-transcripts] create failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn("[supabase/meeting-transcripts] create threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Get the transcript for a meeting (may be null if none was captured). */
export async function getTranscriptForMeeting(meetingId: string): Promise<MeetingTranscript | null> {
  try {
    const { data, error } = await supabase
      .from("meeting_transcripts")
      .select("*")
      .eq("meeting_id", meetingId)
      .maybeSingle();
    if (error) {
      console.warn("[supabase/meeting-transcripts] get failed:", error.message);
      return null;
    }
    return data ? mapRow(data as TranscriptRow) : null;
  } catch (err) {
    console.warn("[supabase/meeting-transcripts] get threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

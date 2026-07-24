/**
 * vinay session journal — the 3-line "what I did / what's open / what's next"
 * record appended at session end (the /end-of-day-sync hook). This is the
 * reachable-today bridge to "track my conversations": rather than reading
 * transcripts (no API for that), each session leaves vinay a compact trace.
 */

import { vinayDb } from "./client";

export interface VinayJournalEntry {
  id: string;
  created_at: string;
  did: string | null;
  open: string | null;
  next: string | null;
  source: string | null;
}

export async function logVinayJournal(data: {
  did?: string | null;
  open?: string | null;
  next?: string | null;
  source?: string | null;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await vinayDb
    .from("vinay_journal")
    .insert({
      did: data.did ?? null,
      open: data.open ?? null,
      next: data.next ?? null,
      source: data.source ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return row;
}

export async function listVinayJournal(
  opts: { limit?: number } = {},
): Promise<VinayJournalEntry[]> {
  const { data, error } = await vinayDb
    .from("vinay_journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 10);
  if (error) throw error;
  return data ?? [];
}

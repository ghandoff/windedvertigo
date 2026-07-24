/**
 * vinay perceived-events store — the raw ledger of things vinay noticed in
 * garrett's streams (calendar, email, exec-agent tables). Idempotent on
 * (source, external_id) so a re-run of the daily sweep never duplicates.
 * Modelled on the spine's event_log ledger (lib/supabase/event-log.ts).
 */

import { vinayDb } from "./client";

export interface VinayEvent {
  id: string;
  source: string;
  external_id: string;
  kind: string | null;
  title: string | null;
  body: string | null;
  event_time: string | null;
  payload: Record<string, unknown> | null;
  perceived_at: string;
}

export interface VinayEventInput {
  source: string;
  external_id: string;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  event_time?: string | null;
  payload?: Record<string, unknown> | null;
}

/** Idempotent upsert on (source, external_id). Returns the number of rows written. */
export async function upsertVinayEvents(rows: VinayEventInput[]): Promise<number> {
  if (!rows.length) return 0;
  const { error, count } = await vinayDb.from("vinay_events").upsert(
    rows.map((r) => ({
      source: r.source,
      external_id: r.external_id,
      kind: r.kind ?? null,
      title: r.title ?? null,
      body: r.body ?? null,
      event_time: r.event_time ?? null,
      payload: r.payload ?? null,
    })),
    { onConflict: "source,external_id", count: "exact" },
  );
  if (error) throw error;
  return count ?? rows.length;
}

export async function listRecentVinayEvents(
  opts: { limit?: number; sinceIso?: string } = {},
): Promise<VinayEvent[]> {
  let q = vinayDb
    .from("vinay_events")
    .select("*")
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 200);
  if (opts.sinceIso) q = q.gte("perceived_at", opts.sinceIso);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

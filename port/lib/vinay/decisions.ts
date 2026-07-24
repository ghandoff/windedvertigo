/**
 * vinay decision log — append-only record of choices/insights from a session.
 * Distinct from working-state memory (mutable key/value) and from the journal
 * (session end-caps). Kept as its own table so a later reflection loop has a
 * clean, immutable history to distil (the ERL pattern from the research sweep).
 */

import { vinayDb } from "./client";

export interface VinayDecision {
  id: string;
  created_at: string;
  decision: string;
  context: string | null;
  category: string | null;
  logged_by: string | null;
}

export async function logVinayDecision(data: {
  decision: string;
  context?: string | null;
  category?: string | null;
  logged_by?: string | null;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await vinayDb
    .from("vinay_decisions")
    .insert({
      decision: data.decision,
      context: data.context ?? null,
      category: data.category ?? null,
      logged_by: data.logged_by ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return row;
}

export async function listVinayDecisions(
  opts: { limit?: number } = {},
): Promise<VinayDecision[]> {
  const { data, error } = await vinayDb
    .from("vinay_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (error) throw error;
  return data ?? [];
}

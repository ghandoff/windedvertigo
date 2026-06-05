import { supabase } from "./client";

export interface CmoDecision {
  id: string;
  created_at: string;
  who: string;
  session_type: string;
  summary: string;
  decisions: string[];
  tags: string[];
  raw_context: string | null;
}

export interface CmoMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export async function insertCmoDecision(data: {
  who: string;
  summary: string;
  decisions?: string[];
  tags?: string[];
  session_type?: string;
  raw_context?: string;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await supabase
    .from("cmo_decisions")
    .insert({
      who: data.who,
      summary: data.summary,
      decisions: data.decisions ?? [],
      tags: data.tags ?? [],
      session_type: data.session_type ?? "cowork",
      raw_context: data.raw_context ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return row;
}

export async function getCmoDecisions(opts: {
  days?: number;
  who?: string;
  tag?: string;
  limit?: number;
}): Promise<CmoDecision[]> {
  let query = supabase
    .from("cmo_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.days) {
    const since = new Date();
    since.setDate(since.getDate() - opts.days);
    query = query.gte("created_at", since.toISOString());
  }
  if (opts.who) {
    query = query.eq("who", opts.who);
  }
  if (opts.tag) {
    query = query.contains("tags", [opts.tag]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertCmoMemory(
  key: string,
  value: string,
  updatedBy: string,
): Promise<{ key: string; updated_at: string }> {
  const { data, error } = await supabase
    .from("cmo_memory")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select("key, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getCmoMemory(): Promise<CmoMemoryEntry[]> {
  const { data, error } = await supabase
    .from("cmo_memory")
    .select("*")
    .order("key");

  if (error) throw error;
  return data ?? [];
}

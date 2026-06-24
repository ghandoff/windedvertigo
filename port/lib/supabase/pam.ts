import { supabase } from "./client";

export interface PamDecision {
  id: string;
  created_at: string;
  who: string;
  session_type: string;
  summary: string;
  decisions: string[];
  tags: string[];
  raw_context: string | null;
}

export interface PamMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export interface PamCommitment {
  id: string;
  created_at: string;
  who: string;
  what: string;
  start_date: string | null;
  due_date: string | null;
  source: string | null;
  depends_on: string[] | null;
  status: "not-started" | "in-progress" | "blocked" | "done" | "parked";
  blocker: string | null;
  completed_at: string | null;
  updated_at: string;
  // whirlpool fields (added 2026-06-24 migration)
  cycle: string | null;           // ISO Monday date of the whirlpool week, e.g. "2026-06-23"
  if_then_plan: string | null;    // implementation intention: "if <cue>, then I'll <action>"
  commitment_type: "action" | "learning" | "connection" | "ritual" | null;
  visibility: "public" | "private"; // public = on the whirlpool board; private = PaM memory only
}

export async function insertPamDecision(data: {
  who: string;
  summary: string;
  decisions?: string[];
  tags?: string[];
  session_type?: string;
  raw_context?: string;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await supabase
    .from("pam_decisions")
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

export async function getPamDecisions(opts: {
  days?: number;
  who?: string;
  tag?: string;
  limit?: number;
}): Promise<PamDecision[]> {
  let query = supabase
    .from("pam_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.days) {
    const since = new Date();
    since.setDate(since.getDate() - opts.days);
    query = query.gte("created_at", since.toISOString());
  }
  if (opts.who) query = query.eq("who", opts.who);
  if (opts.tag) query = query.contains("tags", [opts.tag]);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertPamMemory(
  key: string,
  value: string,
  updatedBy: string,
): Promise<{ key: string; updated_at: string }> {
  const { data, error } = await supabase
    .from("pam_memory")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select("key, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getPamMemory(): Promise<PamMemoryEntry[]> {
  const { data, error } = await supabase.from("pam_memory").select("*").order("key");
  if (error) throw error;
  return data ?? [];
}

export async function getPamCommitments(opts: {
  who?: string;
  status?: string;
  due_before?: string;
  due_after?: string;
  limit?: number;
}): Promise<PamCommitment[]> {
  let query = supabase
    .from("pam_commitments")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 200);

  if (opts.who) query = query.eq("who", opts.who);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.due_before) query = query.lte("due_date", opts.due_before);
  if (opts.due_after) query = query.gte("due_date", opts.due_after);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getWhirlpoolCommitments(cycle: string): Promise<PamCommitment[]> {
  const { data, error } = await supabase
    .from("pam_commitments")
    .select("*")
    .eq("cycle", cycle)
    .eq("visibility", "public")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertPamCommitment(data: {
  who: string;
  what: string;
  start_date?: string;
  due_date?: string;
  source?: string;
  depends_on?: string[];
  cycle?: string;
  if_then_plan?: string;
  commitment_type?: "action" | "learning" | "connection" | "ritual";
  visibility?: "public" | "private";
}): Promise<PamCommitment> {
  const { data: row, error } = await supabase
    .from("pam_commitments")
    .insert({
      who: data.who,
      what: data.what,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      source: data.source ?? null,
      depends_on: data.depends_on ?? null,
      cycle: data.cycle ?? null,
      if_then_plan: data.if_then_plan ?? null,
      commitment_type: data.commitment_type ?? null,
      visibility: data.visibility ?? "public",
      status: "not-started",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return row;
}

export async function deletePamCommitment(id: string): Promise<void> {
  const { error } = await supabase.from("pam_commitments").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePamCommitment(
  id: string,
  data: {
    who?: string;
    status?: string;
    blocker?: string;
    completed_at?: string;
    what?: string;
    start_date?: string;
    due_date?: string;
    depends_on?: string[];
    cycle?: string;
    if_then_plan?: string;
    commitment_type?: string;
    visibility?: string;
  },
): Promise<PamCommitment> {
  const { data: row, error } = await supabase
    .from("pam_commitments")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return row;
}

import { supabase } from "./client";

export interface CarlDecision {
  id: string;
  created_at: string;
  who: string;
  session_type: string;
  summary: string;
  decisions: string[];
  tags: string[];
  raw_context: string | null;
}

export interface CarlMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export interface CarlFinding {
  id: string;
  created_at: string;
  domain: string;
  subtopic: string | null;
  title: string;
  source: string | null;
  citation: string | null;
  summary: string;
  relevance: string | null;
  tags: string[];
  connected_to: string[] | null;
}

// Canonical domain vocabulary (populated by 20260623_carl_domains_vocabulary.sql migration).
// agent_owner can be an agent slug ('mo','pam','biz','carl') or a person slug
// ('jamie','payton','garrett','lamis') — whoever primarily stewards or benefits from this domain.
export interface CarlDomain {
  id: string;
  slug: string;
  label: string;
  section: "learning & pedagogy" | "marketing & growth" | "delivery & ops" | "mission research";
  agent_owner: string;
  sort_order: number;
  depth_target: number;
  created_at: string;
}

// Returns canonical domains ordered by section + sort_order.
// Returns [] gracefully if the carl_domains table hasn't been created yet
// (migration not yet applied) — callers fall back to legacy GROUP BY behaviour.
export async function getCarlDomains(): Promise<CarlDomain[]> {
  const { data, error } = await supabase
    .from("carl_domains")
    .select("*")
    .order("section")
    .order("sort_order");
  if (error) return []; // table not yet created — graceful fallback
  return data ?? [];
}

export async function insertCarlDecision(data: {
  who: string;
  summary: string;
  decisions?: string[];
  tags?: string[];
  session_type?: string;
  raw_context?: string;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await supabase
    .from("carl_decisions")
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

export async function getCarlDecisions(opts: {
  days?: number;
  who?: string;
  tag?: string;
  limit?: number;
}): Promise<CarlDecision[]> {
  let query = supabase
    .from("carl_decisions")
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

export async function upsertCarlMemory(
  key: string,
  value: string,
  updatedBy: string,
): Promise<{ key: string; updated_at: string }> {
  const { data, error } = await supabase
    .from("carl_memory")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select("key, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getCarlMemory(): Promise<CarlMemoryEntry[]> {
  const { data, error } = await supabase.from("carl_memory").select("*").order("key");
  if (error) throw error;
  return data ?? [];
}

export async function getCarlFindings(opts: {
  domain?: string;
  tag?: string;
  search?: string;
  limit?: number;
}): Promise<CarlFinding[]> {
  let query = supabase
    .from("carl_findings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.domain) query = query.eq("domain", opts.domain);
  if (opts.tag) query = query.contains("tags", [opts.tag]);
  if (opts.search) {
    query = query.or(`title.ilike.%${opts.search}%,summary.ilike.%${opts.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function insertCarlFinding(data: {
  domain: string;
  subtopic?: string;
  title: string;
  summary: string;
  source?: string;
  citation?: string;
  relevance?: string;
  tags?: string[];
  connected_to?: string[];
}): Promise<CarlFinding> {
  const { data: row, error } = await supabase
    .from("carl_findings")
    .insert({
      domain: data.domain,
      subtopic: data.subtopic ?? null,
      title: data.title,
      summary: data.summary,
      source: data.source ?? null,
      citation: data.citation ?? null,
      relevance: data.relevance ?? null,
      tags: data.tags ?? [],
      connected_to: data.connected_to ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return row;
}

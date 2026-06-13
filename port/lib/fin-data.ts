/**
 * Fin data layer — typed Supabase queries for the CFO agent.
 * Server-side only (service-role client).
 */

import { supabase } from "./supabase/client";

// ── types ────────────────────────────────────────────────────────────────────

export type FinItemType = "bill" | "invoice" | "tax_notice" | "deadline" | "bank_alert" | "taxdome_message" | "renewal" | "other";
export type FinItemStatus = "pending" | "actioned" | "dismissed" | "snoozed";
export type FinSnapshotType = "p_and_l" | "balance_sheet" | "cash_flow" | "ap_aging" | "ar_aging" | "payroll" | "briefing";
export type FinPatternCycle = "monthly" | "annual" | "quarterly" | "one-off";

export interface FinItem {
  id: string;
  created_at: string;
  type: FinItemType;
  title: string;
  source: string | null;
  amount_cents: number | null;
  currency: string;
  due_date: string | null;
  status: FinItemStatus;
  snooze_until: string | null;
  notes: string | null;
  raw_email_id: string | null;
}

export interface FinDecision {
  id: string;
  created_at: string;
  decision: string;
  context: string | null;
  amount_cents: number | null;
  category: string | null;
  logged_by: string;
}

export interface FinPattern {
  id: string;
  vendor: string;
  description: string;
  typical_amount_cents: number | null;
  typical_cycle: FinPatternCycle;
  last_seen: string | null;
  next_expected: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinSnapshot {
  id: string;
  created_at: string;
  snapshot_type: FinSnapshotType;
  data: Record<string, unknown>;
  period_label: string | null;
  fetched_at: string;
}

export interface FinMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

// ── fin_items ─────────────────────────────────────────────────────────────────

export async function getOpenFinItems(): Promise<FinItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("fin_items")
    .select("*")
    .in("status", ["pending", "snoozed"])
    .or(`snooze_until.is.null,snooze_until.lte.${today}`)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).filter((i) => i.status === "pending" || (i.status === "snoozed" && (!i.snooze_until || i.snooze_until <= today)));
}

export async function getUpcomingFinItems(days = 30): Promise<FinItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("fin_items")
    .select("*")
    .in("status", ["pending", "snoozed"])
    .gte("due_date", today)
    .lte("due_date", cutoff)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createFinItem(item: {
  type: FinItemType;
  title: string;
  source?: string;
  amount_cents?: number;
  currency?: string;
  due_date?: string;
  notes?: string;
  raw_email_id?: string;
}): Promise<FinItem> {
  const { data, error } = await supabase
    .from("fin_items")
    .insert({
      type: item.type,
      title: item.title,
      source: item.source ?? null,
      amount_cents: item.amount_cents ?? null,
      currency: item.currency ?? "USD",
      due_date: item.due_date ?? null,
      notes: item.notes ?? null,
      raw_email_id: item.raw_email_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFinItem(
  id: string,
  update: { status?: FinItemStatus; snooze_until?: string | null; notes?: string },
): Promise<FinItem> {
  const { data, error } = await supabase
    .from("fin_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── fin_decisions ─────────────────────────────────────────────────────────────

export async function getRecentDecisions(limit = 20): Promise<FinDecision[]> {
  const { data, error } = await supabase
    .from("fin_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createFinDecision(d: {
  decision: string;
  context?: string;
  amount_cents?: number;
  category?: string;
  logged_by?: string;
}): Promise<FinDecision> {
  const { data, error } = await supabase
    .from("fin_decisions")
    .insert({
      decision: d.decision,
      context: d.context ?? null,
      amount_cents: d.amount_cents ?? null,
      category: d.category ?? null,
      logged_by: d.logged_by ?? "garrett",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── fin_patterns ──────────────────────────────────────────────────────────────

export async function getUpcomingDeadlines(days = 30): Promise<FinPattern[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("fin_patterns")
    .select("*")
    .gte("next_expected", today)
    .lte("next_expected", cutoff)
    .order("next_expected", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getAllPatterns(): Promise<FinPattern[]> {
  const { data, error } = await supabase
    .from("fin_patterns")
    .select("*")
    .order("next_expected", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

// ── fin_snapshots ─────────────────────────────────────────────────────────────

export async function getLatestSnapshot(type: FinSnapshotType): Promise<FinSnapshot | null> {
  const { data, error } = await supabase
    .from("fin_snapshots")
    .select("*")
    .eq("snapshot_type", type)
    .order("fetched_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getLatestSnapshots(): Promise<Partial<Record<FinSnapshotType, FinSnapshot>>> {
  const types: FinSnapshotType[] = ["p_and_l", "balance_sheet", "cash_flow", "ap_aging", "ar_aging", "payroll", "briefing"];
  const results = await Promise.all(types.map((t) => getLatestSnapshot(t)));
  const out: Partial<Record<FinSnapshotType, FinSnapshot>> = {};
  types.forEach((t, i) => { if (results[i]) out[t] = results[i]!; });
  return out;
}

export async function upsertSnapshot(s: {
  snapshot_type: FinSnapshotType;
  data: Record<string, unknown>;
  period_label?: string;
  fetched_at?: string;
}): Promise<FinSnapshot> {
  const { data, error } = await supabase
    .from("fin_snapshots")
    .insert({
      snapshot_type: s.snapshot_type,
      data: s.data,
      period_label: s.period_label ?? null,
      fetched_at: s.fetched_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── fin_memory ────────────────────────────────────────────────────────────────

export async function getFinMemory(): Promise<FinMemoryEntry[]> {
  const { data, error } = await supabase
    .from("fin_memory")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function upsertFinMemory(key: string, value: string, updated_by: string): Promise<FinMemoryEntry> {
  const { data, error } = await supabase
    .from("fin_memory")
    .upsert({ key, value, updated_by, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

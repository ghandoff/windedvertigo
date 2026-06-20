/**
 * Biz data layer — typed Supabase queries for the business-development agent.
 * Server-side only (service-role client).
 *
 * Opportunity data lives in the existing rfp_* tables (see lib/supabase/rfp-*).
 * This module only owns Biz's own state: decisions, working memory, and the
 * roadmap mirror of docs/biz/feature-catalog.md.
 */

import { supabase } from "./supabase/client";

// ── types ────────────────────────────────────────────────────────────────────

export type BizRoadmapStatus = "shipped" | "planned" | "backlog";

export interface BizDecision {
  id: string;
  created_at: string;
  decision: string;
  context: string | null;
  category: string | null;
  rfp_id: string | null;
  logged_by: string;
}

export interface BizMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export interface BizRoadmapItem {
  id: string;
  feature_id: string;
  title: string;
  theme: string;
  status: BizRoadmapStatus;
  priority: "P1" | "P2" | "P3" | null;
  surface: string | null;
  fixes: string | null;
  notes: string | null;
  updated_at: string;
}

// ── biz_decisions ─────────────────────────────────────────────────────────────

export async function getRecentBizDecisions(limit = 20): Promise<BizDecision[]> {
  const { data, error } = await supabase
    .from("biz_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createBizDecision(d: {
  decision: string;
  context?: string;
  category?: string;
  rfp_id?: string;
  logged_by?: string;
}): Promise<BizDecision> {
  const { data, error } = await supabase
    .from("biz_decisions")
    .insert({
      decision: d.decision,
      context: d.context ?? null,
      category: d.category ?? null,
      rfp_id: d.rfp_id ?? null,
      logged_by: d.logged_by ?? "garrett",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── biz_memory ────────────────────────────────────────────────────────────────

export async function getBizMemory(): Promise<BizMemoryEntry[]> {
  const { data, error } = await supabase
    .from("biz_memory")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function upsertBizMemory(key: string, value: string, updated_by: string): Promise<BizMemoryEntry> {
  const { data, error } = await supabase
    .from("biz_memory")
    .upsert({ key, value, updated_by, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── biz_roadmap ───────────────────────────────────────────────────────────────

export async function getRoadmap(status?: BizRoadmapStatus): Promise<BizRoadmapItem[]> {
  let query = supabase.from("biz_roadmap").select("*");
  if (status) query = query.eq("status", status);
  // P1 before P2 before P3 (nulls last), then by feature_id for stable order
  const { data, error } = await query
    .order("priority", { ascending: true, nullsFirst: false })
    .order("feature_id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Features not yet built — the "upgrades available" set Biz reminds about. */
export async function getAvailableUpgrades(): Promise<BizRoadmapItem[]> {
  const { data, error } = await supabase
    .from("biz_roadmap")
    .select("*")
    .in("status", ["planned", "backlog"])
    .order("status", { ascending: true }) // planned before backlog
    .order("priority", { ascending: true, nullsFirst: false })
    .order("feature_id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function setRoadmapStatus(feature_id: string, status: BizRoadmapStatus): Promise<BizRoadmapItem> {
  const { data, error } = await supabase
    .from("biz_roadmap")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("feature_id", feature_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

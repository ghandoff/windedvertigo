/**
 * vinay anticipation briefs — the daily LLM digest of what's coming, what's
 * unprepared, and what's slipping. During phase 1 garrett reads and grades
 * these (read-only trial) before any autonomy is granted.
 */

import { vinayDb } from "./client";

export interface VinayBriefItem {
  key: string; // stable id so a grade can point at one item
  title: string;
  detail?: string;
}

export interface VinayBrief {
  id: string;
  brief_date: string;
  body: string | null;
  items: VinayBriefItem[] | null;
  event_count: number | null;
  model_id: string | null;
  created_at: string;
}

export async function insertVinayBrief(data: {
  brief_date: string;
  body?: string | null;
  items?: VinayBriefItem[] | null;
  event_count?: number | null;
  model_id?: string | null;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await vinayDb
    .from("vinay_briefs")
    .insert({
      brief_date: data.brief_date,
      body: data.body ?? null,
      items: data.items ?? null,
      event_count: data.event_count ?? null,
      model_id: data.model_id ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return row;
}

export async function getLatestVinayBrief(): Promise<VinayBrief | null> {
  const { data, error } = await vinayDb
    .from("vinay_briefs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as VinayBrief) ?? null;
}

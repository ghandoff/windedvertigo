/**
 * Supabase layer for cmo_timeline_items — the data behind the /mo "timeline"
 * tab's multi-view Gantt. One item set, grouped client-side into four views
 * (workstream / owner / horizon / mission-vs-survival) — see
 * app/(dashboard)/mo/components/timeline-multiview-gantt.tsx.
 *
 * No in-UI editing in v1 (per the spec) — items are agent-seeded via the
 * bearer-gated POST in app/api/cmo/timeline-items/route.ts.
 */

import { supabase } from "./client";

export type TimelineItemKind = "task" | "milestone" | "critical" | "active";

export interface TimelineItem {
  id: string;
  label: string;
  lane: string;
  owner: string | null;
  horizon: string | null;
  track: string | null;
  kind: TimelineItemKind;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string | null;
  sort: number;
  updated_at: string;
  updated_by: string;
}

/**
 * Fetch all timeline items, ordered for stable rendering.
 * Falls back gracefully — callers should `.catch(() => [])`.
 */
export async function getTimelineItems(): Promise<TimelineItem[]> {
  const { data, error } = await supabase
    .from("cmo_timeline_items")
    .select("*")
    .order("sort", { ascending: true })
    .order("start_date", { ascending: true });

  if (error) {
    console.warn("[supabase/cmo-timeline-items] fetch error:", error.message);
    return [];
  }

  return (data ?? []) as TimelineItem[];
}

export interface NewTimelineItem {
  label: string;
  lane: string;
  owner?: string | null;
  horizon?: string | null;
  track?: string | null;
  kind?: TimelineItemKind;
  start_date: string;
  end_date?: string | null;
  sort?: number;
  updated_by: string;
}

/** Agent-seeded create — the only write path in v1 (see route.ts). */
export async function createTimelineItem(item: NewTimelineItem): Promise<TimelineItem> {
  const { data, error } = await supabase
    .from("cmo_timeline_items")
    .insert({
      label: item.label,
      lane: item.lane,
      owner: item.owner ?? null,
      horizon: item.horizon ?? null,
      track: item.track ?? null,
      kind: item.kind ?? "task",
      start_date: item.start_date,
      end_date: item.end_date ?? null,
      sort: item.sort ?? 0,
      updated_by: item.updated_by,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TimelineItem;
}

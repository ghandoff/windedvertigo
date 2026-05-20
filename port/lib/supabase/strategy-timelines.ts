/**
 * Supabase layer for strategy_campaign_timelines.
 *
 * These are the 6 marketing campaigns displayed on the /strategy timeline tab.
 * Previously hardcoded as CAMPAIGN_TIMELINES in strategy-data.ts; moving to
 * Supabase lets dates and milestones be updated without a redeploy.
 *
 * Maps DB rows back to the canonical CampaignTimeline type from strategy-data.ts
 * so all existing component code keeps working unchanged.
 */

import { supabase } from "./client";
import type { CampaignTimeline } from "@/lib/strategy-data";

interface StrategyTimelineRow {
  id: string;
  label: string;
  colour: string;
  dark_text: boolean;
  start_date: string;  // 'YYYY-MM-DD' from Postgres DATE column
  end_date: string;
  milestones: { date: string; label: string }[];
  sort_order: number;
  active: boolean;
}

/**
 * Fetch all active campaign timelines, ordered by sort_order.
 * Falls back gracefully — callers should `.catch(() => [])`.
 */
export async function getStrategyTimelines(): Promise<CampaignTimeline[]> {
  const { data, error } = await supabase
    .from("strategy_campaign_timelines")
    .select("id, label, colour, dark_text, start_date, end_date, milestones, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[supabase/strategy-timelines] fetch error:", error.message);
    return [];
  }

  return (data as StrategyTimelineRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    colour: row.colour,
    ...(row.dark_text ? { darkText: true as const } : {}),
    start: row.start_date,  // 'YYYY-MM-DD' — component appends 'T00:00:00Z'
    end: row.end_date,
    milestones: (row.milestones ?? []).map((m) => ({
      date: m.date,
      label: m.label,
    })),
  }));
}

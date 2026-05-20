/**
 * Supabase layer for strategy_distribution_items.
 *
 * These are the 12 work-distribution assignments displayed on the
 * /strategy distribution tab. Previously hardcoded as DISTRIBUTION in
 * strategy-data.ts; moving to Supabase lets assignments be updated
 * without a redeploy.
 *
 * Maps DB rows back to the canonical DistributionProject type from
 * strategy-data.ts so all existing component code keeps working unchanged.
 */

import { supabase } from "./client";
import type { DistributionProject } from "@/lib/strategy-data";

interface StrategyDistributionRow {
  id: string;
  name: string;
  owner: string;
  support: string[];
  next_action: string;
  deadline: string;
  campaign_id: string | null;
  linked_project_id: string | null;
  sort_order: number;
  active: boolean;
}

/**
 * Fetch all active distribution items, ordered by sort_order.
 * Falls back gracefully — callers should `.catch(() => [])`.
 */
export async function getStrategyDistribution(): Promise<DistributionProject[]> {
  const { data, error } = await supabase
    .from("strategy_distribution_items")
    .select("id, name, owner, support, next_action, deadline, campaign_id, linked_project_id, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[supabase/strategy-distribution] fetch error:", error.message);
    return [];
  }

  return (data as StrategyDistributionRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    owner: row.owner,
    support: row.support ?? [],
    nextAction: row.next_action,
    deadline: row.deadline,
    ...(row.campaign_id ? { campaignId: row.campaign_id } : {}),
    ...(row.linked_project_id ? { linkedProjectId: row.linked_project_id } : {}),
  }));
}

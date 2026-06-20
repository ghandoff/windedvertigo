/**
 * GET /api/biz/briefing — assembled JSON for the business-development agent:
 *   active RFP pipeline (live from rfp_opportunities) + raw pipeline value +
 *   upcoming bid deadlines (next 30 days) + upgrades_available (from biz_roadmap)
 *   + recent decisions + working memory.
 *
 * Read-only: opportunity data is sourced live from the rfp_* tables, so there is
 * no POST snapshot push (unlike fin_briefing). Auth: Bearer CMO_API_TOKEN.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import {
  getRecentBizDecisions,
  getBizMemory,
  getAvailableUpgrades,
} from "@/lib/biz-data";

// statuses that are no longer live pipeline
const TERMINAL = new Set(["won", "lost", "no-go", "missed deadline"]);

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const [{ data: allOpps }, recentDecisions, memory, upgrades] = await Promise.all([
      getRfpOpportunitiesFromSupabase({}, { page: 1, pageSize: 500 }),
      getRecentBizDecisions(10),
      getBizMemory(),
      getAvailableUpgrades(),
    ]);

    const active = allOpps.filter((o) => !TERMINAL.has(o.status));

    // counts by status (radar/reviewing/pursuing/interviewing/submitted)
    const by_status: Record<string, number> = {};
    for (const o of active) by_status[o.status] = (by_status[o.status] ?? 0) + 1;

    const pipeline_value = active.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);

    const pipeline = active
      .slice()
      .sort((a, b) => (a.dueDate?.start ?? "9999").localeCompare(b.dueDate?.start ?? "9999"))
      .map((o) => ({
        id: o.id,
        name: o.opportunityName,
        status: o.status,
        fit: o.wvFitScore,
        value: o.estimatedValue,
        due_date: o.dueDate?.start ?? null,
        proposal_status: o.proposalStatus,
      }));

    // upcoming bid deadlines: active opps with a due_date in the next 30 days
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const upcoming_deadlines = pipeline
      .filter((o) => o.due_date && o.due_date >= today && o.due_date <= cutoff)
      .map((o) => ({ id: o.id, name: o.name, due_date: o.due_date, status: o.status, fit: o.fit }));

    return json({
      pipeline,
      pipeline_count: active.length,
      pipeline_value,
      by_status,
      upcoming_deadlines,
      upcoming_count: upcoming_deadlines.length,
      upgrades_available: upgrades.map((u) => ({
        feature_id: u.feature_id,
        title: u.title,
        status: u.status,
        priority: u.priority,
        surface: u.surface,
        fixes: u.fixes,
      })),
      upgrades_available_count: upgrades.length,
      recent_decisions: recentDecisions,
      memory,
    });
  } catch (err) {
    console.error("[api/biz/briefing] GET failed:", err);
    return error("failed to load briefing", 500);
  }
}

/**
 * GET /api/agent/interventions/metrics
 *
 * Per-agent acted-upon/dismissed/false-escalation rates for
 * agent_interventions — Opsy's future graduation-analysis input (spec
 * acceptance criterion 6: "no dashboard needed yet"). Plain query, not a UI.
 * Same auth pattern as /api/cmo/briefing (a shared bearer token, not a
 * per-agent one — this endpoint spans all agents' rows, not one agent's own
 * data).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getInterventionMetrics } from "@/lib/supabase/agent-interventions";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const days = Number(req.nextUrl.searchParams.get("days")) || 30;
  try {
    const metrics = await getInterventionMetrics(days);
    return json({ days, metrics });
  } catch (err) {
    console.error("[api/agent/interventions/metrics] GET failed:", err);
    return error("failed to compute metrics", 500);
  }
}

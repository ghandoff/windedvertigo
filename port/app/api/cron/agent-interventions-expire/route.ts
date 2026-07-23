/**
 * GET /api/cron/agent-interventions-expire
 *
 * Runs hourly (lib/scheduled.ts CRON_TABLE). Default-deny sweep for
 * HIGH-tier previews: any agent_interventions row still `proposed` past its
 * expires_at flips to `expired` — never auto-executed on timeout
 * (docs/prompts/executive-agents-phase1-build.md §2.3, acceptance
 * criterion 3).
 */

import { NextRequest, NextResponse } from "next/server";
import { expireOverdueInterventions } from "@/lib/supabase/agent-interventions";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const expired = await expireOverdueInterventions();
  return NextResponse.json({ expired });
}

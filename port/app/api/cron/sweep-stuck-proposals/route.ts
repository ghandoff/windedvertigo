/**
 * GET /api/cron/sweep-stuck-proposals
 *
 * Automatic stuck-job sweep for the proposal generation pipeline.
 *
 * Any rfp_opportunity stuck in `proposal_status = 'generating'` for more than
 * STUCK_THRESHOLD_MIN minutes is reset to `'failed'`. This terminates the
 * ghost-run condition that the UI escape hatch (reset-proposal-status) handles
 * manually — this cron handles it automatically.
 *
 * Runs every 5 minutes. Safe to run frequently:
 * - Single UPDATE WHERE ... — atomic at the Postgres level
 * - Returns count of reset rows (0 is the common case)
 *
 * Why 10 minutes? The proposal pipeline normally takes 3–4 minutes. Setting
 * the threshold to 10 minutes gives 2.5× headroom before declaring a job
 * stuck, avoiding false positives from slow Claude calls or cold-start delays.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 30;

const STUCK_THRESHOLD_MIN = 10;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("rfp_opportunities")
    .update({
      proposal_status: "failed",
      proposal_started_at: null,
      proposal_completed_at: null,
    })
    .eq("proposal_status", "generating")
    .lt("proposal_started_at", cutoff)
    .select("notion_page_id, proposal_started_at");

  if (error) {
    console.error("[sweep-stuck-proposals] Supabase update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reset = data ?? [];

  if (reset.length > 0) {
    console.warn(
      `[sweep-stuck-proposals] Reset ${reset.length} stuck proposal(s):`,
      reset.map((r) => r.notion_page_id),
    );
  }

  return NextResponse.json({
    message: reset.length === 0
      ? "no stuck proposals found"
      : `reset ${reset.length} stuck proposal(s) to 'failed'`,
    reset: reset.length,
    ids: reset.map((r) => r.notion_page_id),
  });
}

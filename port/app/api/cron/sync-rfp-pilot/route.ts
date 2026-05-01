/**
 * GET /api/cron/sync-rfp-pilot
 *
 * One-way mirror: Notion rfp_radar DB → Supabase `rfp_opportunities` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * This is the Track A Phase E3 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllRfpOpportunities } from "@/lib/notion/rfp-radar";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const opportunities = await getAllRfpOpportunities();

  if (opportunities.length === 0) {
    return NextResponse.json({ message: "no rfp opportunities found", upserted: 0 });
  }

  const rows = opportunities.map((r) => ({
    notion_page_id: r.id,
    opportunity_name: r.opportunityName ?? "",
    status: r.status ?? null,
    opportunity_type: r.opportunityType ?? null,
    organization_ids: r.organizationIds ?? [],
    estimated_value: r.estimatedValue ?? null,
    due_date: r.dueDate?.start ?? null,
    wv_fit_score: r.wvFitScore ?? null,
    service_match: Array.isArray(r.serviceMatch)
      ? r.serviceMatch.join(",")
      : (r.serviceMatch ?? null),
    category: Array.isArray(r.category)
      ? r.category.join(",")
      : (r.category ?? null),
    geography: Array.isArray(r.geography)
      ? r.geography.join(",")
      : (r.geography ?? null),
    proposal_status: r.proposalStatus ?? null,
    requirements_snapshot: r.requirementsSnapshot ?? null,
    decision_notes: r.decisionNotes ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("rfp_opportunities")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-rfp-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} rfp opportunities to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

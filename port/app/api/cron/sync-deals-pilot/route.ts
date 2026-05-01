/**
 * GET /api/cron/sync-deals-pilot
 *
 * One-way mirror: Notion deals DB → Supabase `deals` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * Track A Phase 4 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllDeals } from "@/lib/notion/deals";
import { supabase } from "@/lib/supabase/client";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deals = await getAllDeals();

  if (deals.length === 0) {
    return NextResponse.json({ message: "no deals found", upserted: 0, total: 0 });
  }

  const rows = deals.map((d) => ({
    notion_page_id: d.id,
    deal: d.deal ?? "",
    stage: d.stage ?? null,
    value: d.value ?? null,
    org_ids: d.organizationIds ?? [],
    rfp_ids: d.rfpOpportunityIds ?? [],
    notes: d.notes ?? null,
    loss_reason: d.lostReason ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("deals")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-deals-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} deals to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

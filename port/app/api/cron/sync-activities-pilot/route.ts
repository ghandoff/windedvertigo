/**
 * GET /api/cron/sync-activities-pilot
 *
 * One-way mirror: Notion activities DB → Supabase `activities` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * This is the Track A Phase 3A Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllActivities } from "@/lib/notion/activities";
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

  const activities = await getAllActivities();

  if (activities.length === 0) {
    return NextResponse.json({ message: "no activities found", upserted: 0 });
  }

  const rows = activities.map((a) => ({
    notion_page_id: a.id,
    activity: a.activity ?? "",
    type: a.type ?? null,
    date: a.date?.start ?? null,
    outcome: a.outcome ?? null,
    notes: a.notes ?? null,
    logged_by: a.loggedBy ?? null,
    organization_ids: a.organizationIds ?? [],
    contact_ids: a.contactIds ?? [],
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("activities")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-activities-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} activities to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

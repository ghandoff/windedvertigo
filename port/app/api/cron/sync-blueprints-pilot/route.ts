/**
 * GET /api/cron/sync-blueprints-pilot
 *
 * One-way mirror: Notion Blueprints DB → Supabase `blueprints` table.
 * Runs daily (blueprints change rarely — they're structural templates).
 * Upserts on notion_page_id (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllBlueprints } from "@/lib/notion/blueprints";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blueprints = await getAllBlueprints();

  if (blueprints.length === 0) {
    return NextResponse.json({ message: "no blueprints to sync", upserted: 0, total: 0 });
  }

  const rows = blueprints.map((b) => ({
    notion_page_id: b.id,
    name: b.name ?? "",
    description: b.description ?? null,
    channels: b.channels ?? [],
    category: b.category ?? null,
    step_count: b.stepCount ?? 0,
    total_days: b.totalDays ?? 0,
    notes: b.notes ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("blueprints")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-blueprints-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} blueprints to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

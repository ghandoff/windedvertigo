/**
 * GET /api/cron/sync-cycles-pilot
 *
 * One-way mirror: Notion Cycles DB → Supabase `cycles` table.
 * Runs every 2 hours. Upserts on notion_page_id (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllCycles } from "@/lib/notion/cycles";
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

  const cycles = await getAllCycles();

  if (cycles.length === 0) {
    return NextResponse.json({ message: "no cycles to sync", upserted: 0, total: 0 });
  }

  const rows = cycles.map((c) => ({
    notion_page_id: c.id,
    cycle: c.cycle ?? "",
    start_date: c.startDate?.start ?? null,
    end_date: c.endDate?.start ?? null,
    project_ids: c.projectIds ?? [],
    status: c.status ?? null,
    goal: c.goal ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("cycles")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-cycles-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} cycles to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

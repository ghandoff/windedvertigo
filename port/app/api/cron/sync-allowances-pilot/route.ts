/**
 * GET /api/cron/sync-allowances-pilot
 *
 * One-way mirror: Notion allowances DB → Supabase `allowances` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * This is the Track A Phase 1 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllAllowances } from "@/lib/notion/allowances";
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

  const allowances = await getAllAllowances();

  if (allowances.length === 0) {
    return NextResponse.json({ message: "no allowances found", upserted: 0 });
  }

  const { data: memberRows } = await supabase
    .from("members")
    .select("id, notion_page_id");
  const memberMap = new Map(
    memberRows?.map((r) => [r.notion_page_id, r.id]) ?? []
  );

  const rows = allowances.map((a) => ({
    notion_page_id: a.id,
    description: a.description,
    category: a.category,
    amount: a.amount,
    active: a.active,
    notes: a.notes || null,
    member_ids: a.memberIds
      .map((nid) => memberMap.get(nid))
      .filter((id): id is string => id !== undefined),
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("allowances")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-allowances-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} allowances to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

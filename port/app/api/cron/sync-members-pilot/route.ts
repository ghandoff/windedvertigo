/**
 * GET /api/cron/sync-members-pilot
 *
 * One-way mirror: Notion members DB → Supabase `members` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * This is the Track A Phase 2 Supabase pilot — Notion stays authoritative
 * for writes; Supabase is read-only until the cut-over.
 *
 * Requires env vars:
 *   CRON_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllMembers } from "@/lib/notion/members";
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

  const members = await getAllMembers();

  if (members.length === 0) {
    return NextResponse.json({ message: "no members found", upserted: 0 });
  }

  const rows = members.map((m) => ({
    notion_page_id: m.id,
    name: m.name,
    email: m.email || null,
    company_role: m.companyRole || null,
    active: m.active,
    capacity: m.capacity || null,
    hourly_rate: m.hourlyRate ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("members")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-members-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} members to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

/**
 * GET /api/cron/sync-contacts-pilot
 *
 * One-way mirror: Notion contacts DB → Supabase `contacts` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * `org_id` is set to organizationIds[0] (primary org).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllContacts } from "@/lib/notion/contacts";
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

  const contacts = await getAllContacts();

  if (contacts.length === 0) {
    return NextResponse.json({ message: "no contacts to sync", upserted: 0, total: 0 });
  }

  const rows = contacts.map((c) => ({
    notion_page_id: c.id,
    name: c.name,
    email: c.email ?? null,
    role: c.role ?? null,
    org_id: c.organizationIds?.[0] ?? null,
    contact_type: c.contactType ?? null,
    relationship_stage: c.relationshipStage ?? null,
    // Phase G.1.2: newly synced columns (requires migration 20260502_contacts_add_warmth_responsiveness)
    contact_warmth: c.contactWarmth ?? null,
    responsiveness: c.responsiveness ?? null,
    referral_potential: c.referralPotential ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("contacts")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-contacts-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} contacts to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}

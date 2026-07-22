/**
 * POST /api/rfp-radar/[id]/verify-tor
 *
 * Marks the TOR document attached to this RFP as "verified" by the current
 * user. Half of the Phase 1 verification gate (the other half is
 * approve-requirement, which approves individual requirement rows).
 *
 * Sets `tor_verified_by` + `tor_verified_at` on rfp_opportunities. The
 * proposal-generate trigger reads these fields to know whether the user
 * has explicitly accepted the auto-extracted TOR document.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { scheduleBriefRegen } from "@/lib/rfp/regenerate-brief";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("rfp_opportunities")
    .update({
      tor_verified_by: session.user.email,
      tor_verified_at: new Date().toISOString(),
    })
    .eq("notion_page_id", id);

  if (error) {
    console.error("[verify-tor] supabase update failed:", error);
    return NextResponse.json({ error: "verification write failed", detail: error.message }, { status: 500 });
  }

  // Now that the TOR is human-verified, rebuild the brief FROM it (provenance
  // flips to "verified-tor") and refresh the thumbnail — in the background.
  await scheduleBriefRegen(id);

  console.warn(`[verify-tor] ${id} verified by ${session.user.email}`);
  return NextResponse.json({ ok: true, verifiedBy: session.user.email, verifiedAt: new Date().toISOString() });
}

/**
 * DELETE /api/rfp-radar/[id]/verify-tor
 *
 * Clears the TOR verification — used when "Replace TOR" is clicked. The user
 * uploads a new TOR (separate route), then re-verifies.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("rfp_opportunities")
    .update({ tor_verified_by: null, tor_verified_at: null })
    .eq("notion_page_id", id);

  if (error) {
    return NextResponse.json({ error: "clear failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

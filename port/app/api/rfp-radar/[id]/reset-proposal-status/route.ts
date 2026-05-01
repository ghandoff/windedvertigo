/**
 * POST /api/rfp-radar/[id]/reset-proposal-status
 *
 * Clears a stuck proposalStatus back to null so the user can re-trigger
 * generation. This is needed when the Inngest function times out or fails
 * without properly updating the status (leaving it stuck on "generating").
 *
 * Now writes directly to Supabase (single SQL UPDATE) rather than through
 * Notion. Also clears the proposal_started_at / proposal_completed_at timing
 * columns so the next generation gets a clean slate.
 *
 * Notion is also updated (non-atomic mirror) for UI display.
 *
 * Auth required. Returns 200 on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { setProposalStatus } from "@/lib/supabase/rfp-opportunities";
import { auth } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  console.log(
    `[reset-proposal-status] rfpId=${id} requestedBy=${session.user.email}`,
  );

  // Primary write: Supabase (clears status + timing columns atomically)
  try {
    await setProposalStatus(id, null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[reset-proposal-status] supabase update failed rfpId=${id}:`, msg);
    return NextResponse.json({ error: "failed to reset status", detail: msg }, { status: 500 });
  }

  // Mirror to Notion for UI display (non-critical, fire-and-forget)
  updateRfpOpportunity(id, { proposalStatus: null }).catch((err) => {
    console.warn("[reset-proposal-status] notion mirror failed (non-fatal):", err);
  });

  console.log(`[reset-proposal-status] ok rfpId=${id}`);
  return NextResponse.json({ ok: true, resetTo: null });
}

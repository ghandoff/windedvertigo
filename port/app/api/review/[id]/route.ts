/**
 * POST /api/review/[id] — approve or dismiss a review-queue item.
 * Body: { action: "approve" | "dismiss" }
 *
 * Approval routes back through the same durable write paths a human would use:
 *   rfp_outcome → transitionRfpStatus (writes Notion + Supabase, fires side-effects
 *                 incl. the won→deal sync)
 *   payment     → updateDealRevenue + a deal_events audit row
 * Session-authenticated; the approver's email is recorded as resolved_by.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReviewItem, resolveReviewItem } from "@/lib/review-queue";
import { transitionRfpStatus } from "@/lib/rfp/transition";
import { updateDealRevenue, insertDealEvent } from "@/lib/supabase/deals";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const by = session?.user?.email;
  if (!by) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be approve or dismiss" }, { status: 400 });
  }

  const item = await getReviewItem(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (item.status !== "pending") {
    return NextResponse.json({ error: `already ${item.status}` }, { status: 409 });
  }

  try {
    if (action === "approve") {
      if (item.kind === "rfp_outcome" && item.rfpId) {
        const status = String(item.proposed.status);
        await transitionRfpStatus(item.rfpId, status, { triggeredBy: by });
      } else if (item.kind === "payment" && item.dealId) {
        const received = Number(item.proposed.received_amount);
        if (Number.isFinite(received)) {
          await updateDealRevenue(item.dealId, { received_amount: received });
          await insertDealEvent(item.dealId, {
            eventType: "payment_received",
            newValue: { received_amount: received },
            note: `approved from /inbox by ${by}`,
          });
        }
      }
    }
    await resolveReviewItem(id, action === "approve" ? "approved" : "dismissed", by);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/review] apply failed:", err);
    return NextResponse.json({ error: "failed to apply" }, { status: 500 });
  }
}

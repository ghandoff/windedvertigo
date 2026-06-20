/**
 * POST /api/biz/outcome — close a bid (won / lost / no-go) with a structured
 * debrief: sets rfp status + the what_worked / what_fell_flat / client_feedback /
 * lessons_for_next_time fields, and logs a biz_decision. Feeds the
 * rfp-postmortem-to-library skill. Auth: Bearer CMO_API_TOKEN.
 *
 * Body: { rfp_id, outcome: 'won'|'lost'|'no-go', what_worked?, what_fell_flat?,
 *         client_feedback?, lessons?, by? }
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { setRfpStatus, setRfpEditableFields } from "@/lib/supabase/rfp-opportunities";
import { createBizDecision } from "@/lib/biz-data";

const VALID = new Set(["won", "lost", "no-go"]);

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.rfp_id) return error("rfp_id is required");
  if (!body?.outcome || !VALID.has(body.outcome)) {
    return error("outcome must be one of: won, lost, no-go");
  }

  try {
    await setRfpStatus(body.rfp_id, body.outcome);
    // only write debrief fields that were provided
    const debrief: Record<string, string | null> = {};
    if (body.what_worked !== undefined) debrief.whatWorked = body.what_worked ?? null;
    if (body.what_fell_flat !== undefined) debrief.whatFellFlat = body.what_fell_flat ?? null;
    if (body.client_feedback !== undefined) debrief.clientFeedback = body.client_feedback ?? null;
    if (body.lessons !== undefined) debrief.lessonsForNextTime = body.lessons ?? null;
    if (Object.keys(debrief).length) {
      await setRfpEditableFields(body.rfp_id, debrief);
    }

    await createBizDecision({
      decision: `outcome: ${body.outcome}`,
      context: body.lessons ?? body.what_worked ?? undefined,
      category: "outcome",
      rfp_id: body.rfp_id,
      logged_by: body.by ?? "biz",
    }).catch(() => {});

    return json({ ok: true, rfp_id: body.rfp_id, outcome: body.outcome });
  } catch (err) {
    console.error("[api/biz/outcome] POST failed:", err);
    return error("failed to record outcome", 500);
  }
}

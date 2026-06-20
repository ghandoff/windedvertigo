/**
 * GET /api/biz/go-no-go/[rfpId] — scoring inputs for a bid/no-bid/defer call:
 * opportunity facts, eligibility requirements, fit, value, deadline, a formula
 * win-probability, and any existing decision. The biz_go_no_go tool fetches
 * this; the agent scores it and records via biz_set_bid_decision.
 * Auth: Bearer CMO_API_TOKEN.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getGoNoGoInputs } from "@/lib/biz-go-no-go";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ rfpId: string }> }) {
  if (!verifyAuth(req)) return error("unauthorized", 401);
  const { rfpId } = await params;
  if (!rfpId) return error("rfpId is required");

  try {
    const inputs = await getGoNoGoInputs(rfpId);
    if (!inputs) return error("opportunity not found", 404);
    return json(inputs);
  } catch (err) {
    console.error("[api/biz/go-no-go] GET failed:", err);
    return error("failed to assemble go/no-go inputs", 500);
  }
}

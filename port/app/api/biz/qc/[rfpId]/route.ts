/**
 * GET /api/biz/qc/[rfpId] — assembled QC inputs for one opportunity: the
 * materials checklist, requirements summary, CV roster + currency, readiness,
 * and the opportunity logistics (due date + timezone, TOR, submission channel).
 * The biz_qc_review MCP tool fetches this; the Cowork agent runs the gates.
 * Auth: Bearer CMO_API_TOKEN.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getQcInputs } from "@/lib/biz-qc";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ rfpId: string }> }) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const { rfpId } = await params;
  if (!rfpId) return error("rfpId is required");

  try {
    const inputs = await getQcInputs(rfpId);
    if (!inputs) return error("opportunity not found", 404);
    return json(inputs);
  } catch (err) {
    console.error("[api/biz/qc] GET failed:", err);
    return error("failed to assemble QC inputs", 500);
  }
}

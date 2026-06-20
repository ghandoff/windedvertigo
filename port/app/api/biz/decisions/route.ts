import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { getRecentBizDecisions, createBizDecision } from "@/lib/biz-data";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const limit = param(req, "limit") ? Number(param(req, "limit")) : 20;

  try {
    const decisions = await getRecentBizDecisions(limit);
    return json(decisions);
  } catch (err) {
    console.error("[api/biz/decisions] GET failed:", err);
    return error("failed to load decisions", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.decision) return error("decision is required");

  try {
    const result = await createBizDecision({
      decision: body.decision,
      context: body.context ?? undefined,
      category: body.category ?? undefined,
      rfp_id: body.rfp_id ?? undefined,
      logged_by: body.logged_by ?? "garrett",
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/biz/decisions] POST failed:", err);
    return error("failed to log decision", 500);
  }
}

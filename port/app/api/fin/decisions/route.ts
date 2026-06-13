import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { getRecentDecisions, createFinDecision } from "@/lib/fin-data";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const limit = param(req, "limit") ? Number(param(req, "limit")) : 20;

  try {
    const decisions = await getRecentDecisions(limit);
    return json(decisions);
  } catch (err) {
    console.error("[api/fin/decisions] GET failed:", err);
    return error("failed to load decisions", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.decision) return error("decision is required");

  try {
    const result = await createFinDecision({
      decision: body.decision,
      context: body.context ?? undefined,
      amount_cents: body.amount_cents ?? undefined,
      category: body.category ?? undefined,
      logged_by: body.logged_by ?? "garrett",
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/fin/decisions] POST failed:", err);
    return error("failed to log decision", 500);
  }
}

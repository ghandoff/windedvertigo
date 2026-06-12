import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { insertOpsyDecision, getOpsyDecisions } from "@/lib/supabase/opsy";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const days = param(req, "days") ? Number(param(req, "days")) : undefined;
  const who = param(req, "who") ?? undefined;
  const tag = param(req, "tag") ?? undefined;

  try {
    const decisions = await getOpsyDecisions({ days, who, tag });
    return json(decisions);
  } catch (err) {
    console.error("[api/opsy/decisions] GET failed:", err);
    return error("failed to load decisions", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.who) return error("who is required");
  if (!body?.summary) return error("summary is required");

  try {
    const result = await insertOpsyDecision({
      who: body.who,
      summary: body.summary,
      decisions: body.decisions ?? [],
      tags: body.tags ?? [],
      session_type: body.session_type ?? "cowork",
      raw_context: body.raw_context ?? undefined,
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/opsy/decisions] POST failed:", err);
    return error("failed to save decision", 500);
  }
}

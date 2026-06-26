import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import {
  getPamCommitments,
  insertPamCommitment,
  updatePamCommitment,
  deletePamCommitment,
} from "@/lib/supabase/pam";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const who = param(req, "who") ?? undefined;
  const status = param(req, "status") ?? undefined;
  const due_before = param(req, "due_before") ?? undefined;
  const due_after = param(req, "due_after") ?? undefined;

  try {
    const commitments = await getPamCommitments({ who, status, due_before, due_after });
    return json(commitments);
  } catch (err) {
    console.error("[api/pam/commitments] GET failed:", err);
    return error("failed to load commitments", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.who) return error("who is required");
  if (!body?.what) return error("what is required");

  try {
    const result = await insertPamCommitment({
      who: body.who,
      what: body.what,
      start_date: body.start_date ?? undefined,
      due_date: body.due_date ?? undefined,
      source: body.source ?? undefined,
      depends_on: body.depends_on ?? undefined,
      cycle: body.cycle ?? undefined,
      if_then_plan: body.if_then_plan ?? undefined,
      commitment_type: body.commitment_type ?? undefined,
      visibility: body.visibility ?? undefined,
      programme: body.programme ?? undefined,
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/pam/commitments] POST failed:", err);
    return error("failed to create commitment", 500);
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const id = param(req, "id");
  if (!id) return error("id is required as query param");

  try {
    await deletePamCommitment(id);
    return json({ ok: true });
  } catch (err) {
    console.error("[api/pam/commitments] DELETE failed:", err);
    return error("failed to delete commitment", 500);
  }
}

export async function PATCH(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const id = param(req, "id");
  if (!id) return error("id is required as query param");

  const body = await req.json().catch(() => null);
  if (!body) return error("request body is required");

  const allowed = ["who", "status", "blocker", "completed_at", "what", "start_date", "due_date", "depends_on", "cycle", "if_then_plan", "commitment_type", "visibility", "programme"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) return error("no valid fields to update");

  try {
    const result = await updatePamCommitment(id, update as Parameters<typeof updatePamCommitment>[1]);
    return json(result);
  } catch (err) {
    console.error("[api/pam/commitments] PATCH failed:", err);
    return error("failed to update commitment", 500);
  }
}

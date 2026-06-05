import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { getCurriculum, updateCurriculumTopic } from "@/lib/supabase/carl-curriculum";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const status = param(req, "status") ?? undefined;
  const domain = param(req, "domain") ?? undefined;

  try {
    const topics = await getCurriculum({ status, domain });
    return json(topics);
  } catch (err) {
    console.error("[api/carl/curriculum] GET failed:", err);
    return error("failed to load curriculum", 500);
  }
}

export async function PATCH(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const id = param(req, "id");
  if (!id) return error("id is required as query param");

  const body = await req.json().catch(() => null);
  if (!body) return error("request body is required");

  const update: { status?: string; notes?: string } = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.notes !== undefined) update.notes = body.notes;
  if (Object.keys(update).length === 0) return error("no valid fields to update");

  try {
    const result = await updateCurriculumTopic(id, update);
    return json(result);
  } catch (err) {
    console.error("[api/carl/curriculum] PATCH failed:", err);
    return error("failed to update curriculum topic", 500);
  }
}

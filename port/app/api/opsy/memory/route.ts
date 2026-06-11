import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { upsertOpsyMemory, getOpsyMemory } from "@/lib/supabase/opsy";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const memory = await getOpsyMemory();
    return json(memory);
  } catch (err) {
    console.error("[api/opsy/memory] GET failed:", err);
    return error("failed to load memory", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.key) return error("key is required");
  if (!body?.value) return error("value is required");
  if (!body?.updated_by) return error("updated_by is required");

  try {
    const result = await upsertOpsyMemory(body.key, body.value, body.updated_by);
    return json(result);
  } catch (err) {
    console.error("[api/opsy/memory] POST failed:", err);
    return error("failed to update memory", 500);
  }
}

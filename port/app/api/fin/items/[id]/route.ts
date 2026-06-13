import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { updateFinItem } from "@/lib/fin-data";

const VALID_STATUSES = ["pending", "actioned", "dismissed", "snoozed"];

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const { id } = await ctx.params;
  if (!id) return error("id is required");

  const body = await req.json().catch(() => null);
  if (!body) return error("request body is required");

  const update: { status?: "pending" | "actioned" | "dismissed" | "snoozed"; snooze_until?: string | null; notes?: string } = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    update.status = body.status;
  }
  if (body.snooze_until !== undefined) update.snooze_until = body.snooze_until;
  if (body.notes !== undefined) update.notes = body.notes;

  if (Object.keys(update).length === 0) return error("no updatable fields provided");

  try {
    const item = await updateFinItem(id, update);
    return json(item);
  } catch (err) {
    console.error("[api/fin/items/[id]] PATCH failed:", err);
    return error("failed to update item", 500);
  }
}

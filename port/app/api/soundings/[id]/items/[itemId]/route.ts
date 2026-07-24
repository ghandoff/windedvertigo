/**
 * PATCH /api/soundings/[id]/items/[itemId] — human triage of one feedback item.
 *
 * Body: { status: "integrated" | "declined", reason?: string }
 *   - integrated: reason is the optional "what changed" note the receipt quotes
 *   - declined:   reason is REQUIRED and non-empty — 400 before the DB is
 *                 touched ("declined with reason" is respect, not rejection)
 *
 * Terminal states are immutable — a second triage attempt 409s. The next
 * soundings-sweep run DMs the reviewer their receipt.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { getItem, setItemStatus } from "@/lib/supabase/sounding-items";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id, itemId } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;

  if (status !== "integrated" && status !== "declined") {
    return error("status must be 'integrated' or 'declined'", 400);
  }
  if (status === "declined" && !reason?.trim()) {
    return error("declined requires a non-empty reason", 400);
  }

  const item = await getItem(itemId);
  if (!item || item.soundingId !== id) return error("not found", 404);
  if (item.status !== "new") {
    return error(`item already triaged (status: ${item.status})`, 409);
  }

  const updated = await setItemStatus(itemId, status, {
    reason,
    setBy: session.user.email,
  });
  if (!updated) return error("triage failed — item may have just been triaged elsewhere", 409);

  return json({ item: updated });
}

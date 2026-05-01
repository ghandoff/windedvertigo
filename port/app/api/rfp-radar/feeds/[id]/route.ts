/**
 * PATCH  /api/rfp-radar/feeds/[id]  — update a feed source
 * DELETE /api/rfp-radar/feeds/[id]  — delete (archive) a feed source
 */

import { NextRequest } from "next/server";
import { updateRfpFeedSource, deleteRfpFeedSource } from "@/lib/notion/rfp-feeds";
import { json, error, withNotionError } from "@/lib/api-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return error("request body required");

  return withNotionError(async () => {
    const feed = await updateRfpFeedSource(id, body);
    return json(feed);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    await deleteRfpFeedSource(id);
    return json({ deleted: true });
  });
}

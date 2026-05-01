/**
 * DELETE /api/assets/{key}
 *
 * Remove a campaign asset from Cloudflare R2.
 */

import { NextRequest } from "next/server";
import { deleteAsset } from "@/lib/r2/upload";
import { json, error } from "@/lib/api-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const assetKey = key.join("/");

  if (!assetKey) return error("Asset key is required");

  try {
    await deleteAsset(assetKey);
    return json({ deleted: assetKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    console.error("[assets/delete]", msg);
    return error(msg, 500);
  }
}

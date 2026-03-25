/**
 * POST /api/email-templates/[id]/use
 *
 * Increment the times-used counter on a template.
 * Called when a template is loaded into a campaign step or email compose.
 */

import { NextRequest } from "next/server";
import { incrementTimesUsed } from "@/lib/notion/email-templates";
import { json, error } from "@/lib/api-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return error("template id required");

  try {
    await incrementTimesUsed(id);
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "failed to increment";
    console.error("[email-templates/use]", msg);
    return error(msg, 500);
  }
}

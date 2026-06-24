/**
 * GET /api/listen/{id} — one listen item plus its ordered audio chunk URLs.
 * Used by the player to build the playback playlist.
 *
 * Audio chunks live in R2 at listen-audio/{id}/{idx}.mp3 and are served from the
 * public port-assets domain (unguessable UUID paths — same privacy model as the
 * existing rfp-docs/*.json objects). Session-gated.
 */

import { auth } from "@/lib/auth";
import { error } from "@/lib/api-helpers";
import { getListenItem, getListenChunks } from "@/lib/supabase/listen";
import { R2_PUBLIC_URL } from "@/lib/r2/client";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const { id } = await ctx.params;
  const item = await getListenItem(id);
  if (!item) return error("not found", 404);

  const base = process.env.R2_PUBLIC_URL ?? R2_PUBLIC_URL;
  const chunks = (await getListenChunks(id)).map((c) => ({
    idx: c.idx,
    url: `${base}/${c.r2_key}`,
    durationMs: c.duration_ms,
  }));

  return Response.json({ item, chunks });
}

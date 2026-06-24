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
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getListenItem, getListenChunks, deleteListenItem } from "@/lib/supabase/listen";
import { R2_PUBLIC_URL } from "@/lib/r2/client";
import "@/lib/cf-env";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const { id } = await ctx.params;
  const item = await getListenItem(id);
  // 404 for both missing and not-yours — items are private to their creator, and
  // we don't leak existence of another user's item.
  if (!item || item.created_by !== session.user.email) return error("not found", 404);

  const base = process.env.R2_PUBLIC_URL ?? R2_PUBLIC_URL;
  const chunks = (await getListenChunks(id)).map((c) => ({
    idx: c.idx,
    url: `${base}/${c.r2_key}`,
    durationMs: c.duration_ms,
  }));

  return Response.json({ item, chunks });
}

/** Delete an item + its R2 audio/text objects. Owner-only. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const { id } = await ctx.params;
  const item = await getListenItem(id);
  if (!item || item.created_by !== session.user.email) return error("not found", 404);

  // Best-effort R2 cleanup (audio chunks + extracted text), then the DB row
  // (listen_chunks cascade). R2 failures don't block the delete — the row going
  // away is what tidies the booth; orphaned objects, if any, are harmless.
  try {
    const chunks = await getListenChunks(id);
    const { env } = getCloudflareContext();
    const keys = [...chunks.map((c) => c.r2_key), item.text_key].filter(Boolean) as string[];
    await Promise.all(keys.map((k) => env.PORT_ASSETS.delete(k).catch(() => {})));
  } catch {
    /* ignore R2 cleanup errors */
  }

  await deleteListenItem(id);
  return Response.json({ ok: true });
}

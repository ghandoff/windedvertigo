/**
 * /api/soundings/[id] — one sounding, in full.
 *
 * GET   — sounding + reviewers + items (transcripts, R2 audio links) — the
 *         whirlpool screen-share view and the triage surface.
 * PATCH — { action: "close" }: human close after the whirlpool. Untriaged
 *         items expire quietly (no receipt, no guilt residue).
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { getSoundingById, closeSounding } from "@/lib/supabase/soundings";
import { listReviewers } from "@/lib/supabase/sounding-reviewers";
import { listItems, expireNewItems } from "@/lib/supabase/sounding-items";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id } = await params;
  const sounding = await getSoundingById(id);
  if (!sounding) return error("not found", 404);

  const [reviewers, items] = await Promise.all([listReviewers(id), listItems(id)]);
  return json({ sounding, reviewers, items });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (body?.action !== "close") return error("unsupported action — only 'close'", 400);

  const sounding = await getSoundingById(id);
  if (!sounding) return error("not found", 404);
  if (sounding.status !== "digested") {
    return error(`only a digested sounding can be closed (status: ${sounding.status})`, 409);
  }

  const closed = await closeSounding(id);
  if (!closed) return error("close failed — already closed?", 409);
  await expireNewItems(id);

  return json({ ok: true });
}

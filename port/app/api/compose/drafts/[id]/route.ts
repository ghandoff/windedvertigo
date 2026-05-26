/**
 * /api/compose/drafts/[id] — get / update / delete a draft.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getComposeDraft,
  updateComposeDraft,
  deleteComposeDraft,
  type ComposeStatus,
} from "@/lib/supabase/compose-drafts";

const VALID_STATUSES: ComposeStatus[] = ["draft", "scheduled", "published", "failed"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const draft = await getComposeDraft(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Parameters<typeof updateComposeDraft>[1] = {};
  if (typeof body.title === "string" || body.title === null) patch.title = body.title as string | null;
  if (typeof body.contentText === "string") patch.contentText = body.contentText;
  if (Array.isArray(body.attachedImageUrls))
    patch.attachedImageUrls = body.attachedImageUrls.filter((u): u is string => typeof u === "string");
  if (typeof body.scheduledFor === "string" || body.scheduledFor === null)
    patch.scheduledFor = body.scheduledFor as string | null;
  if (typeof body.status === "string" && VALID_STATUSES.includes(body.status as ComposeStatus))
    patch.status = body.status as ComposeStatus;

  const draft = await updateComposeDraft(id, patch);
  if (!draft) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ draft });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteComposeDraft(id);
  if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

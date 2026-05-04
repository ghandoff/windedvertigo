/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getSocialDraftByIdFromSupabase,
  upsertSocialDraftToSupabase,
  deleteSocialDraftFromSupabase,
} from "@/lib/supabase/social";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const draft = await getSocialDraftByIdFromSupabase(id);
    if (!draft) return error("Social draft not found", 404);
    return json(draft);
  } catch (err) {
    console.error("[api/social/drafts/[id]] GET failed:", err);
    return error("failed to load social draft", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const patch: Record<string, unknown> = {};
    if (body.content !== undefined) patch.content = body.content;
    if (body.platform !== undefined) patch.platform = body.platform;
    if (body.status !== undefined) patch.status = body.status;
    if (body.organizationId !== undefined) patch.org_id = body.organizationId;
    if (body.scheduledFor !== undefined) patch.scheduled_for = body.scheduledFor?.start ?? null;
    if (body.publishedUrl !== undefined) patch.published_url = body.publishedUrl;

    await upsertSocialDraftToSupabase(id, patch);

    const updated = await getSocialDraftByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/social/drafts/[id]] PATCH failed:", err);
    return error("failed to update social draft", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteSocialDraftFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/social/drafts/[id]] DELETE failed:", err);
    return error("failed to delete social draft", 500);
  }
}

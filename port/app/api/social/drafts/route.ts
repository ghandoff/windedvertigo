/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getSocialDraftsFromSupabase,
  upsertSocialDraftToSupabase,
} from "@/lib/supabase/social";
import { json, error, param } from "@/lib/api-helpers";
import type { SocialDraftStatus, SocialPlatform } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const status = param(req, "status") as SocialDraftStatus | undefined ?? undefined;
  const platform = param(req, "platform") as SocialPlatform | undefined ?? undefined;

  try {
    const data = await getSocialDraftsFromSupabase(status, platform);
    return json({ data, nextCursor: null, hasMore: false });
  } catch (err) {
    console.error("[api/social/drafts] Supabase query failed:", err);
    return error("failed to load social drafts", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.content) return error("content is required");

  try {
    const id = crypto.randomUUID();
    await upsertSocialDraftToSupabase(id, {
      content: body.content,
      platform: body.platform ?? "linkedin",
      status: body.status ?? "draft",
      org_id: body.organizationId ?? null,
      scheduled_for: body.scheduledFor?.start ?? null,
      published_url: null,
    });

    return json({
      id,
      content: body.content,
      platform: body.platform ?? "linkedin",
      status: body.status ?? "draft",
      mediaUrls: "",
      scheduledFor: body.scheduledFor ?? null,
      organizationId: body.organizationId ?? "",
      notes: "",
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/social/drafts] POST failed:", err);
    return error("failed to create social draft", 500);
  }
}

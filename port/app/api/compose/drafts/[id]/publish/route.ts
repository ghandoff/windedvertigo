/**
 * POST /api/compose/drafts/[id]/publish — publish a compose draft.
 *
 * Currently routes LinkedIn drafts to lib/social/linkedin.ts. Other channels
 * return 501 with a clear message until their publish path is wired.
 *
 * On success: status → 'published', published_id + published_at populated.
 * On failure: status → 'failed', last_error populated. Either way returns 200
 * with the updated draft so the UI can show a clear result.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getComposeDraft, updateComposeDraft } from "@/lib/supabase/compose-drafts";
import { createLinkedInPost } from "@/lib/social/linkedin";
import { createBlueskyPost } from "@/lib/social/bluesky";
import { createSubstackDraft } from "@/lib/social/substack";
import { createFacebookPost, createInstagramPost } from "@/lib/social/meta";

export const maxDuration = 60;

export async function POST(
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

  if (draft.status === "published") {
    return NextResponse.json({ error: "already_published", draft }, { status: 409 });
  }

  if (!draft.contentText.trim()) {
    return NextResponse.json({ error: "empty_content" }, { status: 400 });
  }

  // Dispatch per-channel. All channels share the same result shape:
  // { id, url } back from the platform client.
  try {
    let result: { id: string; url: string } | null = null;

    if (draft.channel === "linkedin") {
      result = await createLinkedInPost({
        text: draft.contentText,
        imageUrls: draft.attachedImageUrls,
      });
    } else if (draft.channel === "bluesky") {
      const bsky = await createBlueskyPost({
        text: draft.contentText,
        imageUrls: draft.attachedImageUrls,
      });
      // Normalize Bluesky's { uri, cid, url } to our common { id, url } shape.
      result = { id: bsky.uri, url: bsky.url };
    } else if (draft.channel === "substack") {
      // Substack: lands as a DRAFT in the Substack admin (publish=false).
      // Tonight's MVP intentionally doesn't auto-publish essays — humans
      // review the draft in Substack before sending. Status here becomes
      // 'published' meaning "draft handed off to Substack".
      const sub = await createSubstackDraft({
        title: draft.title ?? "untitled",
        body: draft.contentText,
        publish: false,
      });
      result = { id: String(sub.id), url: sub.url };
    } else if (draft.channel === "meta-facebook") {
      // Facebook: text-only OR text+image. Image is optional.
      // If the draft has multiple images attached, only the first is used —
      // multi-image FB posts (albums) require a different API flow.
      const fb = await createFacebookPost({
        text: draft.contentText,
        imageUrl: draft.attachedImageUrls[0],
      });
      result = fb;
    } else if (draft.channel === "meta-instagram") {
      // Instagram: image is REQUIRED (the Graph API rejects text-only IG posts).
      // Surface a clean 400 here so the UI doesn't have to parse an underlying
      // Meta error message — though the editor already disables publish
      // until an image is attached, this is the belt-and-suspenders gate.
      if (!draft.attachedImageUrls[0]) {
        return NextResponse.json(
          {
            error: "image_required",
            message: "Instagram requires an image. Attach one before publishing.",
          },
          { status: 400 },
        );
      }
      const ig = await createInstagramPost({
        caption: draft.contentText,
        imageUrl: draft.attachedImageUrls[0],
      });
      result = ig;
    } else {
      return NextResponse.json(
        {
          error: "channel_not_yet_supported",
          message: `Publishing for ${draft.channel} ships in a follow-up.`,
        },
        { status: 501 },
      );
    }

    const updated = await updateComposeDraft(draft.id, { status: "published" });
    // Set published_id + published_at via a follow-up update since
    // updateComposeDraft doesn't accept those fields directly.
    if (updated && result) {
      const { supabase } = await import("@/lib/supabase/client");
      await supabase
        .from("compose_drafts")
        .update({
          published_id: result.id,
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", draft.id);
    }
    return NextResponse.json({ ok: true, draft: updated, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`[compose/publish] ${draft.channel} failed:`, message);
    // Mark failed + record the error so the UI can surface it.
    await updateComposeDraft(draft.id, { status: "failed" });
    const { supabase } = await import("@/lib/supabase/client");
    await supabase
      .from("compose_drafts")
      .update({ last_error: message })
      .eq("id", draft.id);
    return NextResponse.json(
      { error: "publish_failed", message },
      { status: 500 },
    );
  }
}

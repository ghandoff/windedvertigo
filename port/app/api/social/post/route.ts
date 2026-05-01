/**
 * POST /api/social/post
 *
 * Publish content to a social platform.
 * Body: { platform, text, imageUrls?, title?, subtitle? }
 *
 * Also updates the social draft status to "posted" if draftId is provided.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { createBlueskyPost, BLUESKY_CHAR_LIMIT } from "@/lib/social/bluesky";
import { createLinkedInPost, LINKEDIN_CHAR_LIMIT } from "@/lib/social/linkedin";
import { createFacebookPost, FACEBOOK_CHAR_LIMIT } from "@/lib/social/meta";
import { createInstagramPost, INSTAGRAM_CHAR_LIMIT } from "@/lib/social/meta";
import { createSubstackDraft } from "@/lib/social/substack";
import { updateSocialDraft } from "@/lib/notion/social";

type Platform = "bluesky" | "linkedin" | "instagram" | "facebook" | "substack" | "twitter";

const PLATFORM_LIMITS: Record<Platform, number> = {
  bluesky: BLUESKY_CHAR_LIMIT,
  linkedin: LINKEDIN_CHAR_LIMIT,
  instagram: INSTAGRAM_CHAR_LIMIT,
  facebook: FACEBOOK_CHAR_LIMIT,
  substack: Infinity,
  twitter: 280,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.platform || !body?.text) {
    return error("platform and text are required");
  }

  const platform = body.platform as Platform;
  const text = body.text as string;
  const imageUrls = (body.imageUrls as string[]) || [];
  const draftId = body.draftId as string | undefined;

  if (!PLATFORM_LIMITS[platform]) {
    return error(`unsupported platform: ${platform}. supported: bluesky, linkedin, instagram, facebook, substack, twitter`);
  }

  if (platform === "twitter") {
    return error("Twitter/X posting is not yet configured. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET to your environment variables.", 501);
  }

  try {
    let result: { url: string; id?: string | number; status?: string };

    switch (platform) {
      case "bluesky":
        result = await createBlueskyPost({ text, imageUrls });
        break;

      case "linkedin":
        result = await createLinkedInPost({ text, imageUrls });
        break;

      case "facebook":
        result = await createFacebookPost({
          text,
          imageUrl: imageUrls[0],
        });
        break;

      case "instagram":
        if (!imageUrls[0]) {
          return error("instagram requires at least one image URL");
        }
        result = await createInstagramPost({
          caption: text,
          imageUrl: imageUrls[0],
        });
        break;

      case "substack":
        if (!body.title) {
          return error("substack requires a title");
        }
        result = await createSubstackDraft({
          title: body.title,
          body: text,
          subtitle: body.subtitle,
          publish: body.publish !== false,
        });
        break;

      default:
        return error(`unsupported platform: ${platform}`);
    }

    // Update social draft status if draftId provided
    if (draftId) {
      try {
        await updateSocialDraft(draftId, { status: "posted" });
      } catch {
        // Non-critical — post was published, draft status update is best-effort
      }
    }

    return json({
      platform,
      published: true,
      url: result.url,
      id: result.id,
      status: result.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "posting failed";
    console.error(`[social/post] ${platform}:`, message);
    return error(message, 500);
  }
}

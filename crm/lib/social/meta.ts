/**
 * Meta Graph API client for Facebook Page + Instagram posting.
 *
 * Requires Meta App Review approval for:
 *   - pages_manage_posts (Facebook page posting)
 *   - instagram_content_publish (Instagram posting)
 *
 * Env vars:
 *   META_PAGE_ACCESS_TOKEN  — long-lived Page Access Token
 *   META_PAGE_ID            — Facebook Page ID
 *   META_IG_USER_ID         — Instagram Business Account ID (linked to the Page)
 *   META_API_VERSION        — e.g., "v22.0" (defaults to v22.0)
 */

const API_VERSION = process.env.META_API_VERSION || "v22.0";
const GRAPH_API = `https://graph.facebook.com/${API_VERSION}`;

export const FACEBOOK_CHAR_LIMIT = 63206;
export const INSTAGRAM_CHAR_LIMIT = 2200;
export const INSTAGRAM_MAX_HASHTAGS = 30;
export const INSTAGRAM_DAILY_POST_LIMIT = 25;

function getConfig() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN not set");
  if (!pageId) throw new Error("META_PAGE_ID not set");
  return { token, pageId };
}

function getIgConfig() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_USER_ID;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN not set");
  if (!igUserId) throw new Error("META_IG_USER_ID not set");
  return { token, igUserId };
}

/** Strip HTML to plain text. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\u2022 ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Facebook ─────────────────────────────────

export interface FacebookPostParams {
  text: string;
  imageUrl?: string; // publicly accessible URL
}

export interface FacebookPostResult {
  id: string;
  url: string;
}

/** Create a post on a Facebook Page. */
export async function createFacebookPost(
  params: FacebookPostParams,
): Promise<FacebookPostResult> {
  const { token, pageId } = getConfig();
  const plainText = htmlToPlainText(params.text);

  let endpoint = `${GRAPH_API}/${pageId}/feed`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    message: plainText,
    access_token: token,
  };

  // If image provided, use photos endpoint instead
  if (params.imageUrl) {
    endpoint = `${GRAPH_API}/${pageId}/photos`;
    body.url = params.imageUrl;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`facebook post failed: ${JSON.stringify(err.error || err)}`);
  }

  const data = await res.json();
  const postId = data.id || data.post_id;

  return {
    id: postId,
    url: `https://www.facebook.com/${postId}`,
  };
}

// ─── Instagram ────────────────────────────────

export interface InstagramPostParams {
  caption: string;
  /** Must be a publicly accessible JPEG URL */
  imageUrl: string;
}

export interface InstagramPostResult {
  id: string;
  url: string;
}

/** Create a post on Instagram (requires image). */
export async function createInstagramPost(
  params: InstagramPostParams,
): Promise<InstagramPostResult> {
  const { token, igUserId } = getIgConfig();
  const plainCaption = htmlToPlainText(params.caption);

  if (plainCaption.length > INSTAGRAM_CHAR_LIMIT) {
    throw new Error(
      `caption exceeds instagram's ${INSTAGRAM_CHAR_LIMIT} character limit (${plainCaption.length} chars)`,
    );
  }

  // Step 1: Create media container
  const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: params.imageUrl,
      caption: plainCaption,
      access_token: token,
    }),
  });

  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}));
    throw new Error(`instagram container creation failed: ${JSON.stringify(err.error || err)}`);
  }

  const containerData = await containerRes.json();
  const containerId = containerData.id;

  if (!containerId) {
    throw new Error("instagram container creation returned no ID");
  }

  // Step 2: Wait for container to be ready (Instagram processes asynchronously)
  // Poll status for up to 30 seconds
  let ready = false;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code&access_token=${token}`,
    );
    const statusData = await statusRes.json();
    if (statusData.status_code === "FINISHED") {
      ready = true;
      break;
    }
    if (statusData.status_code === "ERROR") {
      throw new Error("instagram media processing failed");
    }
  }

  if (!ready) {
    throw new Error("instagram media processing timed out");
  }

  // Step 3: Publish
  const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: token,
    }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error(`instagram publish failed: ${JSON.stringify(err.error || err)}`);
  }

  const publishData = await publishRes.json();

  return {
    id: publishData.id,
    url: `https://www.instagram.com/p/${publishData.id}/`,
  };
}

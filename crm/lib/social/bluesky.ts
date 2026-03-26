/**
 * Bluesky (AT Protocol) posting client — @windedvertigo.bsky.social
 *
 * Uses App Password authentication — no approval process needed.
 * Docs: https://docs.bsky.app/docs/get-started
 *
 * Env vars:
 *   BLUESKY_HANDLE    — e.g., "windedvertigo.bsky.social"
 *   BLUESKY_APP_PASSWORD — generated in Bluesky Settings > App Passwords
 */

const BSKY_API = "https://bsky.social/xrpc";

// Limits
export const BLUESKY_CHAR_LIMIT = 300;
export const BLUESKY_MAX_IMAGES = 4;
export const BLUESKY_MAX_IMAGE_SIZE = 1_000_000; // 1MB

interface BlueskySession {
  did: string;
  accessJwt: string;
  refreshJwt: string;
  handle: string;
}

let cachedSession: BlueskySession | null = null;

/** Create or refresh a Bluesky session using app password. */
async function getSession(): Promise<BlueskySession> {
  if (cachedSession) return cachedSession;

  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    throw new Error("BLUESKY_HANDLE and BLUESKY_APP_PASSWORD must be set");
  }

  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`bluesky auth failed: ${err.message || res.status}`);
  }

  cachedSession = await res.json();
  return cachedSession!;
}

/** Upload an image blob to Bluesky. Returns the blob ref for embedding. */
export async function uploadBlueskyImage(
  imageBuffer: Uint8Array,
  mimeType: string,
): Promise<{ $type: string; ref: { $link: string }; mimeType: string; size: number }> {
  const session = await getSession();

  const res = await fetch(`${BSKY_API}/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: imageBuffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`bluesky image upload failed: ${err.message || res.status}`);
  }

  const data = await res.json();
  return data.blob;
}

/** Parse links and mentions from post text into facets (rich text annotations). */
function detectFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: string; uri?: string; did?: string }>;
}> {
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; uri?: string; did?: string }>;
  }> = [];

  // Detect URLs
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const byteStart = Buffer.byteLength(text.slice(0, match.index), "utf-8");
    const byteEnd = byteStart + Buffer.byteLength(match[0], "utf-8");
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
    });
  }

  return facets;
}

/** Strip HTML tags to plain text for Bluesky (which doesn't support HTML). */
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

export interface BlueskyPostParams {
  /** HTML or plain text content */
  text: string;
  /** Optional image URLs to download and attach */
  imageUrls?: string[];
}

export interface BlueskyPostResult {
  uri: string;
  cid: string;
  url: string;
}

/** Create a post on Bluesky. */
export async function createBlueskyPost(
  params: BlueskyPostParams,
): Promise<BlueskyPostResult> {
  const session = await getSession();
  const plainText = htmlToPlainText(params.text);

  if (plainText.length > BLUESKY_CHAR_LIMIT) {
    throw new Error(
      `post exceeds bluesky's ${BLUESKY_CHAR_LIMIT} character limit (${plainText.length} chars)`,
    );
  }

  // Build the post record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record: Record<string, any> = {
    $type: "app.bsky.feed.post",
    text: plainText,
    createdAt: new Date().toISOString(),
  };

  // Add facets (links, mentions)
  const facets = detectFacets(plainText);
  if (facets.length > 0) {
    record.facets = facets;
  }

  // Upload and embed images if provided
  if (params.imageUrls && params.imageUrls.length > 0) {
    const images = [];
    for (const url of params.imageUrls.slice(0, BLUESKY_MAX_IMAGES)) {
      try {
        const imgRes = await fetch(url);
        const buffer = new Uint8Array(await imgRes.arrayBuffer());
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

        if (buffer.byteLength <= BLUESKY_MAX_IMAGE_SIZE) {
          const blob = await uploadBlueskyImage(buffer, mimeType);
          images.push({ alt: "", image: blob });
        }
      } catch {
        // Skip failed image downloads
      }
    }

    if (images.length > 0) {
      record.embed = {
        $type: "app.bsky.embed.images",
        images,
      };
    }
  }

  // Create the post
  const res = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`bluesky post failed: ${err.message || res.status}`);
  }

  const data = await res.json();

  // Build the public URL
  const postId = data.uri.split("/").pop();
  const url = `https://bsky.app/profile/${session.handle}/post/${postId}`;

  return {
    uri: data.uri,
    cid: data.cid,
    url,
  };
}

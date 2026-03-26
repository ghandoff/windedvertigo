/**
 * LinkedIn posting client.
 *
 * Personal posts only (w_member_social scope).
 * Company page posts require Community Management API approval.
 *
 * Env vars:
 *   LINKEDIN_ACCESS_TOKEN — OAuth 2.0 token with w_member_social scope
 *   LINKEDIN_PERSON_URN   — e.g., "urn:li:person:abc123" (your LinkedIn member URN)
 */

const LI_API = "https://api.linkedin.com/rest";

export const LINKEDIN_CHAR_LIMIT = 3000;

function getConfig() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;
  if (!token) throw new Error("LINKEDIN_ACCESS_TOKEN not set");
  if (!personUrn) throw new Error("LINKEDIN_PERSON_URN not set");
  return { token, personUrn };
}

/** Strip HTML to plain text for LinkedIn text posts. */
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

/** Upload an image to LinkedIn and get the image URN. */
export async function uploadLinkedInImage(
  imageBuffer: Uint8Array,
): Promise<string> {
  const { token, personUrn } = getConfig();

  // Step 1: Initialize upload
  const initRes = await fetch(`${LI_API}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(`linkedin image init failed: ${JSON.stringify(err)}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new Error("linkedin image init returned no uploadUrl or image URN");
  }

  // Step 2: Upload the binary
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer as unknown as BodyInit,
  });

  if (!uploadRes.ok) {
    throw new Error(`linkedin image upload failed: ${uploadRes.status}`);
  }

  return imageUrn;
}

export interface LinkedInPostParams {
  /** HTML or plain text content */
  text: string;
  /** Optional image URLs to download and attach */
  imageUrls?: string[];
}

export interface LinkedInPostResult {
  id: string;
  url: string;
}

/** Create a personal post on LinkedIn. */
export async function createLinkedInPost(
  params: LinkedInPostParams,
): Promise<LinkedInPostResult> {
  const { token, personUrn } = getConfig();
  const plainText = htmlToPlainText(params.text);

  if (plainText.length > LINKEDIN_CHAR_LIMIT) {
    throw new Error(
      `post exceeds linkedin's ${LINKEDIN_CHAR_LIMIT} character limit (${plainText.length} chars)`,
    );
  }

  // Build the post body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postBody: Record<string, any> = {
    author: personUrn,
    commentary: plainText,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
  };

  // Upload and attach images
  if (params.imageUrls && params.imageUrls.length > 0) {
    const images = [];
    for (const url of params.imageUrls.slice(0, 1)) {
      // LinkedIn supports 1 image per post via this method
      try {
        const imgRes = await fetch(url);
        const buffer = new Uint8Array(await imgRes.arrayBuffer());
        const imageUrn = await uploadLinkedInImage(buffer);
        images.push({ id: imageUrn });
      } catch {
        // Skip failed uploads
      }
    }

    if (images.length > 0) {
      postBody.content = {
        media: { id: images[0].id },
      };
    }
  }

  const res = await fetch(`${LI_API}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(postBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`linkedin post failed: ${JSON.stringify(err)}`);
  }

  // LinkedIn returns the post URN in the x-restli-id header
  const postUrn = res.headers.get("x-restli-id") || "";
  const activityId = postUrn.replace("urn:li:share:", "").replace("urn:li:ugcPost:", "");

  return {
    id: postUrn,
    url: `https://www.linkedin.com/feed/update/${postUrn}`,
  };
}

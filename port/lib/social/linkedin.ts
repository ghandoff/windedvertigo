// LinkedIn token expires ~May 25 2026
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


// ── stats ──────────────────────────────────────────────────

export interface LinkedInStats {
  followerCount: number | null;
  /** Total reactions + comments on posts in the current window. */
  recentPostEngagement: number;
  fetchedAt: string;
}

/**
 * Fetch LinkedIn org page stats.
 *
 * Endpoint: GET /v2/organizationPageStatistics?q=organization&organization={ORG_URN}
 * Requires: LINKEDIN_ACCESS_TOKEN + LINKEDIN_ORG_ID env vars.
 *           Token needs `r_organization_admin` or `r_organization_social` scope.
 *
 * On 401: attempts one token refresh via refreshLinkedInToken() and retries.
 * On any other error or missing env var: returns null followerCount.
 */
export async function getLinkedInStats(): Promise<LinkedInStats> {
  const fetchedAt = new Date().toISOString();
  const orgId = process.env.LINKEDIN_ORG_ID;

  if (!orgId) {
    console.warn("[social/linkedin] LINKEDIN_ORG_ID not set — follower stats unavailable");
    return { followerCount: null, recentPostEngagement: 0, fetchedAt };
  }

  const orgUrn = `urn:li:organization:${orgId}`;

  async function fetchStats(token: string): Promise<Response> {
    return fetch(
      `https://api.linkedin.com/v2/organizationPageStatistics?q=organization&organization=${encodeURIComponent(orgUrn)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
          "User-Agent": "wv-port/1.0 (+port.windedvertigo.com)",
        },
      },
    );
  }

  let token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    console.warn("[social/linkedin] LINKEDIN_ACCESS_TOKEN not set — stats unavailable");
    return { followerCount: null, recentPostEngagement: 0, fetchedAt };
  }

  try {
    let res = await fetchStats(token);

    // On 401, try refreshing the token once.
    if (res.status === 401) {
      console.warn("[social/linkedin] token expired — attempting refresh");
      try {
        const { refreshLinkedInToken } = await import("./linkedin-token");
        const refreshed = await refreshLinkedInToken();
        token = refreshed.accessToken;
        res = await fetchStats(token);
      } catch (refreshErr) {
        console.warn("[social/linkedin] token refresh failed:", refreshErr);
        return { followerCount: null, recentPostEngagement: 0, fetchedAt };
      }
    }

    if (!res.ok) {
      console.warn(`[social/linkedin] org stats returned ${res.status}`);
      return { followerCount: null, recentPostEngagement: 0, fetchedAt };
    }

    const data = await res.json();

    // Response shape: { elements: [{ totalPageStatistics: { followers: { totalFollowerCount } } }] }
    const element = Array.isArray(data.elements) ? data.elements[0] : null;
    const totalFollowerCount =
      element?.totalPageStatistics?.followers?.totalFollowerCount ?? null;

    // Pull engagement from the most recent monthly bucket if present.
    const monthly: Array<{ totalPageStatistics?: { views?: { allPageViews?: { pageViews?: number } } } }>
      = element?.timeRange ? [] : (data.elements ?? []).slice(1);
    const recentEngagement = monthly.reduce(
      (sum: number, m) => sum + (m?.totalPageStatistics?.views?.allPageViews?.pageViews ?? 0),
      0,
    );

    return {
      followerCount: typeof totalFollowerCount === "number" ? totalFollowerCount : null,
      recentPostEngagement: recentEngagement,
      fetchedAt,
    };
  } catch (err) {
    console.warn("[social/linkedin] getStats exception:", err);
    return { followerCount: null, recentPostEngagement: 0, fetchedAt };
  }
}

/**
 * Substack posting client (unofficial API).
 *
 * Uses reverse-engineered endpoints — not officially supported by Substack.
 * Authentication via session cookie from a logged-in browser session.
 *
 * Env vars:
 *   SUBSTACK_PUBLICATION  — e.g., "windedvertigo" (subdomain)
 *   SUBSTACK_COOKIE       — substack.sid cookie value from browser session
 *   SUBSTACK_USER_ID      — your Substack user ID (numeric)
 */

export const SUBSTACK_PUBLICATION = process.env.SUBSTACK_PUBLICATION || "windedvertigo";

function getConfig() {
  const publication = process.env.SUBSTACK_PUBLICATION;
  const cookie = process.env.SUBSTACK_COOKIE;
  if (!publication) throw new Error("SUBSTACK_PUBLICATION not set");
  if (!cookie) throw new Error("SUBSTACK_COOKIE not set");
  return { publication, cookie };
}

function getBaseUrl() {
  const { publication } = getConfig();
  return `https://${publication}.substack.com`;
}

/** Strip HTML to Substack-compatible HTML (it accepts rich HTML in body). */
function cleanHtml(html: string): string {
  // Substack accepts HTML directly — just ensure it's well-formed
  return html.trim();
}

export interface SubstackPostParams {
  /** Post title */
  title: string;
  /** HTML body content */
  body: string;
  /** Post subtitle (optional) */
  subtitle?: string;
  /** Publish immediately or save as draft */
  publish?: boolean;
}

export interface SubstackPostResult {
  id: number;
  url: string;
  status: "draft" | "published";
}

/** Create a draft on Substack. */
export async function createSubstackDraft(
  params: SubstackPostParams,
): Promise<SubstackPostResult> {
  const { cookie } = getConfig();
  const baseUrl = getBaseUrl();

  // Step 1: Create draft
  const draftRes = await fetch(`${baseUrl}/api/v1/drafts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `substack.sid=${cookie}`,
    },
    body: JSON.stringify({
      draft_title: params.title,
      draft_subtitle: params.subtitle || "",
      draft_body: cleanHtml(params.body),
      type: "newsletter",
    }),
  });

  if (!draftRes.ok) {
    const err = await draftRes.text();
    throw new Error(`substack draft creation failed: ${err.slice(0, 200)}`);
  }

  const draft = await draftRes.json();
  const draftId = draft.id;

  if (!draftId) {
    throw new Error("substack draft creation returned no ID");
  }

  // Step 2: Publish if requested
  if (params.publish) {
    const publishRes = await fetch(`${baseUrl}/api/v1/drafts/${draftId}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `substack.sid=${cookie}`,
      },
      body: JSON.stringify({}),
    });

    if (!publishRes.ok) {
      // Draft was created but publish failed — return as draft
      return {
        id: draftId,
        url: `${baseUrl}/publish/post/${draftId}`,
        status: "draft",
      };
    }

    const published = await publishRes.json();
    return {
      id: draftId,
      url: published.canonical_url || `${baseUrl}/p/${draft.slug}`,
      status: "published",
    };
  }

  return {
    id: draftId,
    url: `${baseUrl}/publish/post/${draftId}`,
    status: "draft",
  };
}

// ── stats ──────────────────────────────────────────────────

export interface SubstackStats {
  totalSubscribers: number | null;
  freeSubscribers: number | null;
  paidSubscribers: number | null;
  /** Count of posts published in the last 90 days (from RSS). */
  recentPostViews: number | null;
  fetchedAt: string;
}

/**
 * Fetch Substack publication stats.
 *
 * Subscriber count:  unofficial /api/v1/publication endpoint (session cookie).
 * Recent posts:      RSS feed → count items published in the last 90 days.
 *
 * Both calls degrade to null if the cookie is missing/expired.
 */
export async function getSubstackStats(): Promise<SubstackStats> {
  const fetchedAt = new Date().toISOString();
  const publication = process.env.SUBSTACK_PUBLICATION;
  const cookie = process.env.SUBSTACK_COOKIE;

  if (!publication) {
    console.warn("[social/substack] SUBSTACK_PUBLICATION not set — stats unavailable");
    return { totalSubscribers: null, freeSubscribers: null, paidSubscribers: null, recentPostViews: null, fetchedAt };
  }

  const baseUrl = `https://${publication}.substack.com`;
  let freeSubscribers: number | null = null;
  let paidSubscribers: number | null = null;
  let totalSubscribers: number | null = null;

  // ── 1. Subscriber counts via unofficial API ─────────────
  if (cookie) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/publication`, {
        headers: {
          Cookie: `substack.sid=${cookie}`,
          "User-Agent": "wv-port/1.0 (+port.windedvertigo.com)",
        },
      });

      if (res.ok) {
        const data = await res.json();
        // The publication endpoint returns a `stats` object.
        const stats = data?.stats ?? data;
        const freeCount  = stats?.free_subscribers_count   ?? stats?.free_subscription_count   ?? null;
        const paidCount  = stats?.paid_subscribers_count   ?? stats?.paid_subscription_count   ?? null;
        const totalCount = stats?.active_subscriptions_count ?? null;

        if (typeof freeCount  === "number") freeSubscribers  = freeCount;
        if (typeof paidCount  === "number") paidSubscribers  = paidCount;
        if (typeof totalCount === "number") {
          totalSubscribers = totalCount;
        } else if (freeSubscribers !== null || paidSubscribers !== null) {
          totalSubscribers = (freeSubscribers ?? 0) + (paidSubscribers ?? 0);
        }
      } else {
        console.warn(`[social/substack] publication API returned ${res.status} — subscriber counts unavailable`);
      }
    } catch (err) {
      console.warn("[social/substack] subscriber fetch exception:", err);
    }
  }

  // ── 2. Recent post count via RSS ────────────────────────
  let recentPostViews: number | null = null;
  try {
    const rssRes = await fetch(`${baseUrl}/feed`, {
      headers: { "User-Agent": "wv-port/1.0 (+port.windedvertigo.com)" },
    });

    if (rssRes.ok) {
      const xml = await rssRes.text();
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      // Extract all <pubDate> values and count those within the last 90 days.
      const pubDates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)]
        .map((m) => new Date(m[1].trim()))
        .filter((d) => !Number.isNaN(d.getTime()) && d >= cutoff);

      recentPostViews = pubDates.length;
    }
  } catch (err) {
    console.warn("[social/substack] RSS fetch exception:", err);
  }

  return { totalSubscribers, freeSubscribers, paidSubscribers, recentPostViews, fetchedAt };
}

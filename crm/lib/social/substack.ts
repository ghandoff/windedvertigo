/**
 * Substack posting client (unofficial API).
 *
 * Uses reverse-engineered endpoints — not officially supported by Substack.
 * Authentication via session cookie from a logged-in browser session.
 *
 * Env vars:
 *   SUBSTACK_PUBLICATION  — e.g., "windedvertigo" (subdomain)
 *   SUBSTACK_COOKIE       — connect.sid cookie value from browser session
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
      Cookie: `connect.sid=${cookie}`,
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
        Cookie: `connect.sid=${cookie}`,
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

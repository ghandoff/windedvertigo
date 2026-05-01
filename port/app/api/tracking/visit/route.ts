/**
 * POST /api/tracking/visit
 *
 * Lightweight endpoint for windedvertigo.com (or any w.v property) to report
 * site visits originating from campaign emails. Closes the attribution chain:
 *
 *   email sent → recipient clicks link → lands on site with UTM params →
 *   site beacon calls this endpoint → Activity logged on the org in Port.
 *
 * Expected payload:
 * {
 *   utm_source: "resend",
 *   utm_medium: "email",
 *   utm_campaign: "first-hello",
 *   utm_content: "org-{notionId}",     // org attribution from campaign UTM
 *   page_url: "/portfolio",            // page visited
 *   referrer?: "...",                   // optional referrer
 * }
 *
 * The endpoint extracts the org ID from utm_content, validates it, and creates
 * a "site visit" Activity on the org. Protected by a bearer token to prevent
 * abuse (TRACKING_API_TOKEN env var).
 */

import { NextRequest, NextResponse } from "next/server";
import { createActivity } from "@/lib/notion/activities";

export async function POST(req: NextRequest) {
  // Validate bearer token
  const token = process.env.TRACKING_API_TOKEN;
  if (token) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[tracking/visit] TRACKING_API_TOKEN not set — rejecting in production");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { utm_source, utm_campaign, utm_content, page_url } = body;

  // Extract org ID from utm_content (format: "org-{id}" or "variant-a_org-{id}")
  const orgIdMatch = utm_content?.match(/org-([a-f0-9-]{36})/);
  const orgId = orgIdMatch?.[1];

  if (!orgId) {
    // Not an attributed visit — no org to log against
    return NextResponse.json({ ok: true, note: "no org attribution in utm_content" });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const pageDisplay = page_url?.replace(/^https?:\/\/(www\.)?windedvertigo\.com/, "") || "/";

    await createActivity({
      activity: `site visit: ${pageDisplay}`,
      type: "site visit",
      organizationIds: [orgId],
      date: { start: today, end: null },
      notes: [
        `page: ${page_url || "/"}`,
        utm_campaign ? `campaign: ${utm_campaign}` : null,
        utm_source ? `source: ${utm_source}` : null,
        body.referrer ? `referrer: ${body.referrer}` : null,
      ].filter(Boolean).join("\n"),
      loggedBy: "site beacon",
    });

    return NextResponse.json({ ok: true, orgId });
  } catch (err) {
    console.error("[tracking/visit]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "failed to log visit" }, { status: 500 });
  }
}

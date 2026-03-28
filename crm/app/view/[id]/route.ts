/**
 * GET /view/[id]
 *
 * Public (no auth) — "view in browser" link from email footers.
 * Fetches the email draft from Notion by ID and returns rendered HTML.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getEmailDraft } from "@/lib/notion/email-drafts";
import { buildEmailHtml } from "@/lib/email/templates";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const draft = await getEmailDraft(id);
    const html = buildEmailHtml(draft.body, { senderName: "Garrett" });
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;color:#6b7280;">
        <p>This email is no longer available.</p>
      </body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

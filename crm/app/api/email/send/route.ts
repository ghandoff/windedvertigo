/**
 * POST /api/email/send
 *
 * Send an outreach email via Resend.
 * - Fetches org to get email + bespokeEmailCopy
 * - Uses bespokeEmailCopy as default body if none provided
 * - Updates connection status in Notion after send
 */

import { NextRequest } from "next/server";
import { getOrganization, updateConnection, updateOutreachStatus } from "@/lib/notion/organizations";
import { createEmailDraft, updateEmailDraft } from "@/lib/notion/email-drafts";
import { createActivity } from "@/lib/notion/activities";
import { sendOutreachEmail } from "@/lib/email/resend";
import { buildEmailHtml, htmlToPlainText } from "@/lib/email/templates";
import { resolveTemplateVars } from "@/lib/campaign/template-vars";
import { rehostImages } from "@/lib/email/rehost-images";
import { buildUnsubscribeUrl, buildViewInBrowserUrl } from "@/lib/email/unsubscribe";
import { json, error } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  // `to` is required — either array or semicolon/comma-separated string
  const rawTo: string | string[] = body?.to ?? "";
  const to: string[] = Array.isArray(rawTo)
    ? rawTo.map((s: string) => s.trim()).filter(Boolean)
    : rawTo.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean);

  if (!body?.body) return error("body is required");
  if (to.length === 0) return error("at least one recipient is required");

  try {
    // Load org context when provided (for merge tags and status updates)
    const org = body.organizationId ? await getOrganization(body.organizationId) : null;

    const subject = body.subject ?? org?.subject ?? `From winded.vertigo`;
    const rawBody: string = body.body;

    // Resolve merge tags before rendering HTML.
    // Guard: if the body IS the bespoke copy (pre-filled from org), don't pass
    // bespokeEmailCopy as a context var — otherwise {{bespokeEmailCopy}} tags
    // inside it would expand again, doubling all the content.
    // Pre-create draft to get its ID for the "view in browser" URL (non-critical — continue on fail)
    let draft: { id: string } | null = null;
    try {
      draft = await createEmailDraft({
        subject,
        body: "",
        status: "sending",
        organizationId: org?.id ?? "",
        sentAt: new Date().toISOString(),
        opens: 0,
        clicks: 0,
      });
    } catch (draftErr) {
      console.warn("[email/send] pre-create draft failed:", draftErr instanceof Error ? draftErr.message : draftErr);
    }

    const unsubscribeUrl = org ? buildUnsubscribeUrl(org.id) : undefined;
    const viewInBrowserUrl = draft ? buildViewInBrowserUrl(draft.id) : undefined;
    const bodyIsBespoke = !!(org?.bespokeEmailCopy && rawBody === org.bespokeEmailCopy);
    const resolvedBody = resolveTemplateVars(rawBody, {
      orgName: org?.organization,
      senderName: body.senderName,
      orgEmail: org?.email,
      orgWebsite: org?.website,
      bespokeEmailCopy: bodyIsBespoke ? undefined : org?.bespokeEmailCopy,
      outreachSuggestion: org?.outreachSuggestion,
      unsubscribeUrl,
      viewInBrowserUrl,
    });

    const rehostedBody = await rehostImages(resolvedBody);
    const html = buildEmailHtml(rehostedBody, {
      orgName: org?.organization,
      senderName: body.senderName,
      unsubscribeUrl,
      viewInBrowserUrl,
    });
    const text = htmlToPlainText(resolvedBody);

    const result = await sendOutreachEmail({
      to,
      subject,
      html,
      text,
      from: body.from,
      replyTo: body.replyTo,
      tags: org ? [{ name: "org_id", value: org.id }] : [],
    });

    if (org) {
      // Advance connection pipeline if currently in early stages
      if (org.connection === "unengaged" || org.connection === "exploring") {
        await updateConnection(org.id, "in progress");
      }

      // Advance outreach status if not yet contacted
      if (!org.outreachStatus || org.outreachStatus === "Not started" || org.outreachStatus === "Researching") {
        await updateOutreachStatus(org.id, "Contacted");
      }
    }

    // Update pre-created draft with resolved content and Resend message ID (non-critical)
    const resendMessageId = result.data?.id ?? "";
    try {
      if (draft) {
        await updateEmailDraft(draft.id, {
          subject,
          body: rawBody,
          status: "sent",
          resendMessageId,
        });
      } else {
        await createEmailDraft({
          subject,
          body: rawBody,
          status: "sent",
          organizationId: org?.id ?? "",
          sentAt: new Date().toISOString(),
          resendMessageId,
          opens: 0,
          clicks: 0,
        });
      }
    } catch (draftErr) {
      console.warn("[email/send] draft update failed (non-critical):", draftErr instanceof Error ? draftErr.message : draftErr);
    }

    // Auto-log activity for linked contacts
    if (org?.contactIds?.length) {
      try {
        await createActivity({
          activity: `email sent: ${subject}`,
          type: "email sent",
          contactIds: [org.contactIds[0]],
          organizationIds: [org.id],
          date: { start: new Date().toISOString().split("T")[0], end: null },
          notes: `sent via CRM to ${to.join(", ")}`,
          loggedBy: body.senderName || "CRM",
        });
      } catch {
        // non-critical — don't fail the send
      }
    }

    return json({ messageId: resendMessageId, status: "sent" }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    console.error("[email/send]", msg);
    return error(msg, 500);
  }
}

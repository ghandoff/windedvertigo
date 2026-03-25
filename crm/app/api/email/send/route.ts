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
import { createEmailDraft } from "@/lib/notion/email-drafts";
import { createActivity } from "@/lib/notion/activities";
import { sendOutreachEmail } from "@/lib/email/resend";
import { buildEmailHtml } from "@/lib/email/templates";
import { json, error } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organizationId) return error("organizationId is required");

  try {
    const org = await getOrganization(body.organizationId);

    const to = body.to ?? org.email;
    if (!to) return error("No email address found for this organization");

    const subject = body.subject ?? org.subject ?? `From winded.vertigo`;
    const rawBody = body.body ?? org.bespokeEmailCopy;
    if (!rawBody) return error("No email body provided and no bespoke email copy on file");

    const html = buildEmailHtml(rawBody, {
      orgName: org.organization,
      senderName: body.senderName,
    });

    const result = await sendOutreachEmail({
      to,
      subject,
      html,
      from: body.from,
      replyTo: body.replyTo,
      tags: [{ name: "org_id", value: org.id }],
    });

    // Advance connection pipeline if currently in early stages
    if (
      org.connection === "unengaged" ||
      org.connection === "exploring"
    ) {
      await updateConnection(org.id, "in progress");
    }

    // Advance outreach status if not yet contacted
    if (
      !org.outreachStatus ||
      org.outreachStatus === "Not started" ||
      org.outreachStatus === "Researching"
    ) {
      await updateOutreachStatus(org.id, "Contacted");
    }

    // Record the sent email in the Email Drafts database for tracking
    const resendMessageId = result.data?.id ?? "";
    await createEmailDraft({
      subject,
      body: rawBody,
      status: "sent",
      organizationId: org.id,
      sentAt: new Date().toISOString(),
      resendMessageId,
      opens: 0,
      clicks: 0,
    });

    // Auto-log activity for linked contacts
    if (org.contactIds?.length) {
      try {
        await createActivity({
          activity: `email sent: ${subject}`,
          type: "email sent",
          contactIds: [org.contactIds[0]],
          organizationIds: [org.id],
          date: { start: new Date().toISOString().split("T")[0], end: null },
          notes: `sent via CRM to ${to}`,
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

/**
 * Batch email send logic for campaign steps.
 *
 * Sends emails to all orgs in an audience, batched 10 at a time to respect
 * Resend rate limits. Creates EmailDraft records and updates outreach status.
 */

import { sendOutreachEmail } from "@/lib/email/resend";
import { buildEmailHtml } from "@/lib/email/templates";
import { createEmailDraft } from "@/lib/notion/email-drafts";
import { updateOutreachStatus, updateConnection } from "@/lib/notion/organizations";
import { resolveTemplateVars, type TemplateContext } from "./template-vars";
import type { Organization } from "@/lib/notion/types";

const BATCH_SIZE = 10;

export interface BatchSendParams {
  subject: string;
  body: string;
  senderName?: string;
  orgs: Organization[];
}

export interface BatchSendResult {
  sent: number;
  skipped: number;
  failed: number;
}

async function sendSingleEmail(
  org: Organization,
  subject: string,
  body: string,
  senderName: string,
): Promise<"sent" | "skipped"> {
  if (!org.email) return "skipped";

  const ctx: TemplateContext = {
    orgName: org.organization,
    senderName,
    orgEmail: org.email,
    orgWebsite: org.website,
  };

  const resolvedSubject = resolveTemplateVars(subject, ctx);
  const resolvedBody = resolveTemplateVars(body, ctx);
  const html = buildEmailHtml(resolvedBody, { orgName: org.organization, senderName });

  const result = await sendOutreachEmail({
    to: org.email,
    subject: resolvedSubject,
    html,
    tags: [{ name: "org_id", value: org.id }, { name: "source", value: "campaign" }],
  });

  const resendMessageId = result.data?.id ?? "";

  // Record in email drafts DB
  await createEmailDraft({
    subject: resolvedSubject,
    body: resolvedBody,
    status: "sent",
    organizationId: org.id,
    sentAt: new Date().toISOString(),
    resendMessageId,
    opens: 0,
    clicks: 0,
  });

  // Advance outreach status if early stage
  if (
    !org.outreachStatus ||
    org.outreachStatus === "Not started" ||
    org.outreachStatus === "Researching"
  ) {
    await updateOutreachStatus(org.id, "Contacted");
  }

  // Advance connection if unengaged/exploring
  if (org.connection === "unengaged" || org.connection === "exploring") {
    await updateConnection(org.id, "in progress");
  }

  return "sent";
}

export async function batchSendEmails(params: BatchSendParams): Promise<BatchSendResult> {
  const { subject, body, senderName = "Garrett", orgs } = params;
  const result: BatchSendResult = { sent: 0, skipped: 0, failed: 0 };

  // Filter out orgs with no email upfront
  const withEmail = orgs.filter((o) => o.email);
  result.skipped = orgs.length - withEmail.length;

  // Send in batches
  for (let i = 0; i < withEmail.length; i += BATCH_SIZE) {
    const batch = withEmail.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((org) => sendSingleEmail(org, subject, body, senderName)),
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value === "sent") {
        result.sent++;
      } else if (r.status === "fulfilled" && r.value === "skipped") {
        result.skipped++;
      } else {
        result.failed++;
        if (r.status === "rejected") {
          console.error("[batch-send] failed:", r.reason);
        }
      }
    }
  }

  return result;
}

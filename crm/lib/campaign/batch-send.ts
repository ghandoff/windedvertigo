/**
 * Batch email send logic for campaign steps.
 *
 * Sends emails to all orgs in an audience, batched 10 at a time to respect
 * Resend rate limits. Creates EmailDraft records and updates outreach status.
 */

import { sendOutreachEmail } from "@/lib/email/resend";
import { buildEmailHtml } from "@/lib/email/templates";
import { createEmailDraft, queryEmailDrafts } from "@/lib/notion/email-drafts";
import { createSocialDraft } from "@/lib/notion/social";
import { updateOutreachStatus, updateConnection } from "@/lib/notion/organizations";
import { resolveTemplateVars, type TemplateContext } from "./template-vars";
import type { Organization, SocialPlatform } from "@/lib/notion/types";

const BATCH_SIZE = 10;

// ── conditional branching ────────────────────────────────

export interface StepCondition {
  previousStep?: "opened" | "clicked" | "notOpened" | "notClicked";
}

/**
 * Filter audience based on engagement with a previous step.
 * Checks EmailDraft records to see which orgs opened/clicked.
 */
export async function filterByCondition(
  orgs: Organization[],
  condition: StepCondition,
  previousStepOrgIds?: string[],
): Promise<Organization[]> {
  if (!condition.previousStep || !previousStepOrgIds) return orgs;

  // Query all email drafts to find opens/clicks for previous step recipients
  const { data: drafts } = await queryEmailDrafts(undefined, { pageSize: 100 });

  // Build sets of org IDs that had engagement
  const orgIdsWithOpens = new Set<string>();
  const orgIdsWithClicks = new Set<string>();
  for (const draft of drafts) {
    if (!previousStepOrgIds.includes(draft.organizationId)) continue;
    if (draft.opens > 0) orgIdsWithOpens.add(draft.organizationId);
    if (draft.clicks > 0) orgIdsWithClicks.add(draft.organizationId);
  }

  switch (condition.previousStep) {
    case "opened":
      return orgs.filter((o) => orgIdsWithOpens.has(o.id));
    case "notOpened":
      return orgs.filter((o) => !orgIdsWithOpens.has(o.id));
    case "clicked":
      return orgs.filter((o) => orgIdsWithClicks.has(o.id));
    case "notClicked":
      return orgs.filter((o) => !orgIdsWithClicks.has(o.id));
    default:
      return orgs;
  }
}

export interface BatchSendParams {
  subject: string;
  body: string;
  senderName?: string;
  orgs: Organization[];
  /** A/B test: variant B subject + body. First half gets A, second half gets B. */
  variantBSubject?: string;
  variantBBody?: string;
}

export interface BatchSendResult {
  sent: number;
  skipped: number;
  failed: number;
  variantA?: number;
  variantB?: number;
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
  const { subject, body, senderName = "Garrett", orgs, variantBSubject, variantBBody } = params;
  const hasAB = !!(variantBSubject && variantBBody);
  const result: BatchSendResult = { sent: 0, skipped: 0, failed: 0 };
  if (hasAB) {
    result.variantA = 0;
    result.variantB = 0;
  }

  // Filter out orgs with no email upfront
  const withEmail = orgs.filter((o) => o.email);
  result.skipped = orgs.length - withEmail.length;

  // A/B split: sort by ID for deterministic split, first half A, second half B
  const sorted = hasAB ? [...withEmail].sort((a, b) => a.id.localeCompare(b.id)) : withEmail;
  const midpoint = Math.ceil(sorted.length / 2);

  // Send in batches
  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const batch = sorted.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((org, batchIdx) => {
        const globalIdx = i + batchIdx;
        const isVariantB = hasAB && globalIdx >= midpoint;
        const useSubject = isVariantB ? variantBSubject! : subject;
        const useBody = isVariantB ? variantBBody! : body;
        return sendSingleEmail(org, useSubject, useBody, senderName);
      }),
    );

    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      const globalIdx = i + j;
      const isVariantB = hasAB && globalIdx >= midpoint;

      if (r.status === "fulfilled" && r.value === "sent") {
        result.sent++;
        if (hasAB) {
          if (isVariantB) result.variantB!++;
          else result.variantA!++;
        }
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

// ── multi-channel: social draft creation ─────────────────

export interface BatchSocialParams {
  body: string;
  platform: SocialPlatform;
  orgs: Organization[];
  senderName?: string;
}

export interface BatchSocialResult {
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Create social drafts for all orgs in the audience.
 * Each org gets its own social draft with resolved template variables.
 * Drafts land in the social queue kanban as "draft" status.
 */
export async function batchCreateSocialDrafts(
  params: BatchSocialParams,
): Promise<BatchSocialResult> {
  const { body, platform, orgs, senderName = "Garrett" } = params;
  const result: BatchSocialResult = { created: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
    const batch = orgs.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (org) => {
        const ctx: TemplateContext = {
          orgName: org.organization,
          senderName,
          orgEmail: org.email,
          orgWebsite: org.website,
        };
        const resolvedBody = resolveTemplateVars(body, ctx);

        await createSocialDraft({
          content: resolvedBody,
          platform,
          status: "draft",
          organizationId: org.id,
        });
        return "created" as const;
      }),
    );

    for (const r of settled) {
      if (r.status === "fulfilled") {
        result.created++;
      } else {
        result.failed++;
        console.error("[batch-social] failed:", r.reason);
      }
    }
  }

  return result;
}

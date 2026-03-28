/**
 * Batch email send logic for campaign steps.
 *
 * Sends emails to all orgs in an audience, batched 10 at a time to respect
 * Resend rate limits. Creates EmailDraft records and updates outreach status.
 */

import { sendOutreachEmail } from "@/lib/email/resend";
import { buildEmailHtml, htmlToPlainText } from "@/lib/email/templates";
import { buildUnsubscribeUrl, buildViewInBrowserUrl } from "@/lib/email/unsubscribe";
import { createEmailDraft, updateEmailDraft, queryEmailDrafts } from "@/lib/notion/email-drafts";
import { createActivity } from "@/lib/notion/activities";
import { createSocialDraft } from "@/lib/notion/social";
import { updateOutreachStatus, updateConnection } from "@/lib/notion/organizations";
import { resolveTemplateVars, type TemplateContext } from "./template-vars";
import { rehostImages } from "@/lib/email/rehost-images";
import { tagLinksWithUtm, buildEmailUtmParams } from "./utm";
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
  /** Campaign name — used for UTM attribution on outgoing links. */
  campaignName?: string;
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
  campaignName?: string,
  variant?: "a" | "b",
): Promise<"sent" | "skipped"> {
  if (!org.email) return "skipped";

  const unsubscribeUrl = buildUnsubscribeUrl(org.id);

  // Pre-create draft to get its ID for the "view in browser" URL
  const draft = await createEmailDraft({
    subject: "pending",
    body: "",
    status: "sending",
    organizationId: org.id,
    sentAt: new Date().toISOString(),
    opens: 0,
    clicks: 0,
  });
  const viewInBrowserUrl = buildViewInBrowserUrl(draft.id);

  const ctx: TemplateContext = {
    orgName: org.organization,
    senderName,
    orgEmail: org.email,
    orgWebsite: org.website,
    bespokeEmailCopy: org.bespokeEmailCopy,
    outreachSuggestion: org.outreachSuggestion,
    unsubscribeUrl,
    viewInBrowserUrl,
  };

  const resolvedSubject = resolveTemplateVars(subject, ctx);
  const resolvedBody = resolveTemplateVars(body, ctx);
  const rehostedBody = await rehostImages(resolvedBody);
  let html = buildEmailHtml(rehostedBody, { orgName: org.organization, senderName, unsubscribeUrl, viewInBrowserUrl });
  const text = htmlToPlainText(resolvedBody);

  // Tag windedvertigo.com links with UTM params for campaign attribution
  if (campaignName) {
    html = tagLinksWithUtm(html, buildEmailUtmParams(campaignName, variant));
  }

  const result = await sendOutreachEmail({
    to: org.email,
    subject: resolvedSubject,
    html,
    text,
    tags: [{ name: "org_id", value: org.id }, { name: "source", value: "campaign" }],
  });

  const resendMessageId = result.data?.id ?? "";

  // Update the pre-created draft with resolved content and Resend message ID
  await updateEmailDraft(draft.id, {
    subject: resolvedSubject,
    body: resolvedBody,
    status: "sent",
    resendMessageId,
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

  // Auto-log activity for linked contacts
  if (org.contactIds?.length) {
    try {
      await createActivity({
        activity: `campaign email: ${resolvedSubject}`,
        type: "email sent",
        contactIds: [org.contactIds[0]],
        organizationIds: [org.id],
        date: { start: new Date().toISOString().split("T")[0], end: null },
        notes: `batch campaign send to ${org.email}`,
        loggedBy: senderName,
      });
    } catch {
      // non-critical
    }
  }

  return "sent";
}

export async function batchSendEmails(params: BatchSendParams): Promise<BatchSendResult> {
  const { subject, body, senderName = "Garrett", orgs, campaignName, variantBSubject, variantBBody } = params;
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
        const variant = hasAB ? (isVariantB ? "b" as const : "a" as const) : undefined;
        return sendSingleEmail(org, useSubject, useBody, senderName, campaignName, variant);
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
          bespokeEmailCopy: org.bespokeEmailCopy,
          outreachSuggestion: org.outreachSuggestion,
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

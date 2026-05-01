/**
 * @windedvertigo/port-jobs — CF Queue Consumer Worker
 *
 * Processes all job queues for wv-port. Single worker consumes three queues,
 * routing by batch.queue name to the appropriate handler.
 *
 * Queues consumed:
 *   wv-port-proposal-queue     → handleProposalJob
 *   wv-port-timesheet-queue    → handleTimesheetJob
 *   wv-port-rfp-document-queue → handleRfpDocumentJob
 *
 * Migration status:
 *   ✅ Scaffold + routing  — G.2.1 (Phase A.2 unblocked)
 *   ✅ Consumer handlers   — G.2.2
 *
 * Architecture notes:
 *   - step.run() removed throughout — CF Queues retries the entire message,
 *     not individual steps. Handlers must be idempotent.
 *   - Inngest generateProposalFailureHandler → DLQ handler (queue name suffix -dlq)
 *   - All process.env.*  reads are seeded at handler start via seedProcessEnv().
 *   - R2 writes use the native PORT_ASSETS binding, not the S3-compatible client.
 */

import { createQueueConsumer } from "@windedvertigo/job-queue";
import type {
  RfpProposalJob,
  TimesheetStatusJob,
  RfpDocumentUploadedJob,
} from "@windedvertigo/job-queue/types";

// Business logic from port/lib — resolved via tsconfig @/* path alias.
// These modules use process.env.* which is seeded per-invocation below.
import {
  getRfpOpportunity,
  updateRfpOpportunity,
} from "@/lib/notion/rfp-radar";
import type { QuestionBank } from "@/lib/inngest/functions/parse-rfp-questions";
import { getOrganization } from "@/lib/notion/organizations";
import { getActivitiesForOrg } from "@/lib/notion/activities";
import { queryBdAssets, incrementBdAssetUsage } from "@/lib/notion/bd-assets";
import { queryBibliography } from "@/lib/notion/bibliography";
import { queryRateReference } from "@/lib/notion/rate-reference";
import { createDeal } from "@/lib/notion/deals";
import { generateProposal, TEAM_BIOS } from "@/lib/ai/proposal-generator";
import { matchCitations } from "@/lib/ai/citation-matcher";
import { postToSlack } from "@/lib/slack";
import { notion } from "@/lib/notion/client";
import { getTimesheet } from "@/lib/notion/timesheets";
import { getActiveMembers } from "@/lib/notion/members";
import { sendOutreachEmail } from "@/lib/email/resend";
import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "@/lib/ai/usage-store";

// ── Env type ─────────────────────────────────────────────────────────────────

export interface Env {
  // Secrets (injected by CF Workers runtime, seeded into process.env below)
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  SLACK_WEBHOOK_URL: string;
  SLACK_BOT_TOKEN: string;
  NOTION_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // Plain-text vars (set in wrangler.jsonc [vars])
  R2_PUBLIC_URL: string; // public domain for port-assets bucket

  // Native R2 binding (used directly — not via S3 SDK)
  PORT_ASSETS: R2Bucket;
}

// ── Queue name constants ──────────────────────────────────────────────────────

const QUEUE_PROPOSAL     = "wv-port-proposal-queue";
const QUEUE_TIMESHEET    = "wv-port-timesheet-queue";
const QUEUE_RFP_DOCUMENT = "wv-port-rfp-document-queue";
const QUEUE_PROPOSAL_DLQ = "wv-port-proposal-queue-dlq";

// R2 public URL is read from env.R2_PUBLIC_URL (wrangler.jsonc [vars]).
// The constant below is a fallback for type safety only — the env value always wins.

// ── process.env seed ──────────────────────────────────────────────────────────
// port/lib/ modules read process.env.*. With the nodejs_compat flag, process.env
// is available in CF Workers but does not automatically reflect wrangler secrets.
// We seed it once per batch so all downstream imports see the correct values.

function seedProcessEnv(env: Env): void {
  process.env.ANTHROPIC_API_KEY       = env.ANTHROPIC_API_KEY;
  process.env.RESEND_API_KEY          = env.RESEND_API_KEY;
  process.env.SLACK_WEBHOOK_URL       = env.SLACK_WEBHOOK_URL;
  process.env.SLACK_BOT_TOKEN         = env.SLACK_BOT_TOKEN;
  process.env.NOTION_TOKEN            = env.NOTION_TOKEN;
  process.env.SUPABASE_URL            = env.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_KEY    = env.SUPABASE_SERVICE_KEY;
}

// ── Shared Notion block builders (copied from generate-proposal.ts) ────────────

const CRM_BASE_URL = "https://port.windedvertigo.com";

function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function para(text: string): any {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }] } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heading1(text: string): any {
  return { object: "block", type: "heading_1", heading_1: { rich_text: [{ type: "text", text: { content: text } }] } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heading2(text: string): any {
  return { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: text } }] } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heading3(text: string): any {
  return { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: text } }] } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bulletItem(text: string): any {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }] } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calloutBlock(text: string, emoji: string): any {
  return { object: "block", type: "callout", callout: { rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }], icon: { type: "emoji", emoji } } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function divider(): any {
  return { object: "block", type: "divider", divider: {} };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sectionToBlocks(text: string): any[] {
  if (!text) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];
  const parts = text.split(/(🎨 Visual aide:[^\n]+)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("🎨 Visual aide:")) {
      blocks.push(calloutBlock(trimmed.replace("🎨 Visual aide:", "").trim(), "🎨"));
    } else {
      const paragraphs = trimmed.split(/\n{2,}/);
      for (const p of paragraphs) {
        const chunk = p.trim();
        if (!chunk) continue;
        if (chunk.length <= 1800) {
          blocks.push(para(chunk));
        } else {
          const sentences = chunk.split(/(?<=\. )/);
          let current = "";
          for (const s of sentences) {
            if (current.length + s.length > 1800) {
              if (current) blocks.push(para(current.trim()));
              current = s;
            } else {
              current += s;
            }
          }
          if (current.trim()) blocks.push(para(current.trim()));
        }
      }
    }
  }
  return blocks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function appendBlocks(pageId: string, blocks: any[]): Promise<void> {
  const CHUNK_SIZE = 90;
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    await notion.blocks.children.append({
      block_id: pageId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: blocks.slice(i, i + CHUNK_SIZE) as any,
    });
  }
}

// ── Proposal consumer ─────────────────────────────────────────────────────────
// Migrated from: port/lib/inngest/functions/generate-proposal.ts
//
// Key differences from Inngest version:
//   - No step.run() wrappers — CF Queues retries the whole message on failure
//   - generateProposalFailureHandler → handled by DLQ consumer below
//   - All awaits are direct, sequential or parallel as before

const proposalConsumer = createQueueConsumer<RfpProposalJob>(
  async (payload, env) => {
    seedProcessEnv(env as unknown as Env);
    const { rfpId, triggeredBy } = payload;

    // 1. Fetch RFP
    let rfp;
    try {
      rfp = await getRfpOpportunity(rfpId);
    } catch (err) {
      console.error("[proposal] failed to fetch RFP:", err);
      await postToSlack(`⚠️ Proposal generation failed for RFP \`${rfpId}\` — could not fetch record from Notion.`);
      return { success: false, error: "rfp_not_found" };
    }

    updateRfpOpportunity(rfpId, { proposalStatus: "generating" }).catch(() => {});

    const rfpName = rfp.opportunityName || "Unnamed RFP";

    // 2. Validate required fields
    const missingRequired: string[] = [];
    if (!rfp.dueDate?.start) missingRequired.push("due date");
    if (!rfp.opportunityType && !rfp.url && rfpName === "Unnamed RFP") {
      missingRequired.push("opportunity type or URL");
    }

    if (missingRequired.length > 0) {
      updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch(() => {});
      await postToSlack(
        `⚠️ *${rfpName}* moved to pursuing but is missing info needed for proposal generation.\n\n` +
        `Please add the following to the Notion record:\n${missingRequired.map((f) => `• ${f}`).join("\n")}\n\n` +
        `Generation will not proceed until these are added.`,
      );
      return { success: false, error: "missing_required_fields" };
    }

    // 3. Parallel data fetch
    const orgId = rfp.organizationIds?.[0] ?? null;
    const rfpGeo = rfp.geography?.[0] ?? undefined;
    const funderTypeKeys = ["UN System", "IDB", "USAID"];
    const inferredFunderType =
      (rfp.source === "Email Alert" || rfp.source === "Manual Entry")
        ? undefined
        : (funderTypeKeys.find((k) => rfp.opportunityName?.toLowerCase().includes(k.toLowerCase())) ?? undefined);

    const [org, activities, bdAssetsResult, allCitations, rateRefs] = await Promise.all([
      orgId ? getOrganization(orgId).catch(() => null) : Promise.resolve(null),
      orgId ? getActivitiesForOrg(orgId).then((r) => r.data).catch(() => []) : Promise.resolve([]),
      queryBdAssets(undefined, { pageSize: 50 }).then((r) => r.data).catch(() => []),
      queryBibliography().catch(() => []),
      queryRateReference({ funderType: inferredFunderType, geography: rfpGeo }).catch(() => []),
    ]);

    // 4. Warn about missing enriching fields (non-blocking)
    const missingEnriching: string[] = [];
    if (!rfp.estimatedValue) missingEnriching.push("estimated contract value");
    if (!rfp.serviceMatch?.length) missingEnriching.push("service match");
    if (!rfp.requirementsSnapshot) missingEnriching.push("requirements snapshot");

    if (missingEnriching.length > 0) {
      postToSlack(
        `🎯 *${rfpName}* moved to *pursuing* — generating a proposal draft now.\n\n` +
        `A few details would sharpen the output:\n${missingEnriching.map((f) => `• ${f}`).join("\n")}\n\n` +
        `Update the <${CRM_BASE_URL}/rfp-radar|RFP Lighthouse record> anytime.`,
      ).catch(() => {});
    }

    // 4b. Fetch document requirements
    let documentRequirements: string | null = null;
    if (rfp.rfpDocumentUrl && rfp.rfpDocumentUrl.startsWith("http")) {
      try {
        const docRes = await fetch(rfp.rfpDocumentUrl, { signal: AbortSignal.timeout(15000) });
        if (docRes.ok) {
          const contentType = docRes.headers.get("content-type") ?? "";
          if (contentType.includes("text/plain")) {
            documentRequirements = (await docRes.text()).slice(0, 8000);
          }
        }
      } catch { /* non-fatal */ }
    }

    // 4c. Fetch question bank
    let questionBank: QuestionBank | null = null;
    if (rfp.questionBankUrl && rfp.questionBankUrl.startsWith("http")) {
      try {
        const qbRes = await fetch(rfp.questionBankUrl, { signal: AbortSignal.timeout(10000) });
        if (qbRes.ok) questionBank = await qbRes.json() as QuestionBank;
      } catch { /* non-fatal */ }
    }

    // 4d. Match bibliography citations
    let relevantCitations = null;
    if (allCitations.length > 0) {
      relevantCitations = await matchCitations({ rfp, allCitations, userId: triggeredBy }).catch(() => null);
    }

    // 5. Generate proposal draft (direct call — no step.run checkpoint)
    let draft: import("@/lib/ai/proposal-generator").ProposalDraft;
    try {
      draft = await generateProposal({
        rfp,
        org,
        recentActivities: activities,
        bdAssets: bdAssetsResult,
        userId: triggeredBy,
        documentRequirements,
        questionBank,
        relevantCitations,
        rateRefs: rateRefs.length > 0 ? rateRefs : null,
      });
    } catch (err) {
      console.error("[proposal] Claude generation failed:", err);
      updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch(() => {});
      await postToSlack(`⚠️ Proposal draft generation failed for *${rfpName}*. The AI call encountered an error. Please try again or draft manually.`);
      return { success: false, error: "generation_failed" };
    }

    // 6. Create Deal in Notion
    const dueLabel   = formatDate(rfp.dueDate?.start);
    const valueLabel = rfp.estimatedValue
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rfp.estimatedValue)
      : null;
    const dealTitle  = `${rfpName}${org ? ` — ${org.organization}` : ""}`;

    let deal;
    try {
      deal = await createDeal({
        deal: dealTitle,
        stage: "identified",
        organizationIds: orgId ? [orgId] : [],
        rfpOpportunityIds: [rfpId],
        value: rfp.estimatedValue ?? undefined,
        closeDate: rfp.dueDate ?? undefined,
        notes: `Auto-generated from RFP Lighthouse on ${new Date().toISOString().split("T")[0]}. Triggered by ${triggeredBy}.`,
      });
    } catch (err) {
      console.error("[proposal] failed to create Deal:", err);
      updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch(() => {});
      await postToSlack(`⚠️ Proposal draft was generated for *${rfpName}* but could not create a Deal record in Notion.`);
      return { success: false, error: "deal_creation_failed" };
    }

    // 6b. Append proposal content as Notion blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      calloutBlock(
        [
          `📋 RFP: ${rfpName}`,
          `🏢 Client: ${org?.organization ?? "Unknown"}`,
          `📅 Due: ${dueLabel}`,
          valueLabel ? `💰 Value: ${valueLabel}` : "",
          rfp.opportunityType ? `📌 Type: ${rfp.opportunityType}` : "",
        ].filter(Boolean).join("\n"),
        "📋",
      ),
      divider(),
      heading1("Executive Summary"),        ...sectionToBlocks(draft.executiveSummary),         divider(),
      heading1("Understanding of Requirements"), ...sectionToBlocks(draft.understandingOfRequirements), divider(),
      heading1("Proposed Approach"),        ...sectionToBlocks(draft.proposedApproach),          divider(),
      heading1("Relevant Experience"),
      ...draft.relevantExperience.flatMap((exp) => [heading3(exp.project), ...sectionToBlocks(exp.relevance)]),
      divider(),
      heading1("Team Composition"),         ...sectionToBlocks(draft.teamComposition),           divider(),
      heading1("Value Proposition"),        ...sectionToBlocks(draft.valueProposition),          divider(),
      heading1("Budget Framework"),         ...sectionToBlocks(draft.budgetFramework),           divider(),
      heading1("Risk Mitigation"),          ...sectionToBlocks(draft.riskMitigation),
    ];

    if (draft.clarifyingQuestions.length > 0) {
      blocks.push(divider(), heading2("❓ Clarifying Questions for Client"), ...draft.clarifyingQuestions.map((q) => bulletItem(q)));
    }
    if (draft.missingInfo.length > 0) {
      blocks.push(divider(), heading2("🔍 Gaps to Fill Before Submitting"), ...draft.missingInfo.map((m) => para(m)));
    }
    if (draft.references.length > 0) {
      blocks.push(divider(), heading2("References"), ...draft.references.map((r) => para(r)));
    }

    try {
      await appendBlocks(deal.id, blocks);
    } catch (err) {
      console.warn("[proposal] block append failed:", err);
    }

    // 6c. Write proposal status back to RFP
    const dealUrl = notionUrl(deal.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rfpUpdates: any = { proposalStatus: "ready-for-review", proposalDraftUrl: dealUrl };

    // 6d. Increment timesUsed on cited BD assets
    const citedAssetIds = draft.relevantExperience.map((e) => e.assetId).filter((id): id is string => !!id);
    if (citedAssetIds.length > 0) {
      await Promise.all(citedAssetIds.map((id) => incrementBdAssetUsage(id).catch(() => {})));
    }

    // 6e. Generate cover letter sub-page
    let coverLetterUrl: string | null = null;
    if (draft.requiresCoverLetter && draft.coverLetter) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clPage = await notion.pages.create({ parent: { page_id: deal.id }, properties: { title: [{ type: "text", text: { content: `Cover Letter — ${rfpName}` } }] } } as any);
        await appendBlocks(clPage.id, [calloutBlock(`Cover letter for: ${rfpName}\nDue: ${dueLabel}`, "📬"), divider(), ...sectionToBlocks(draft.coverLetter)]);
        coverLetterUrl = notionUrl(clPage.id);
        rfpUpdates.coverLetterUrl = coverLetterUrl;
      } catch (err) {
        console.warn("[proposal] cover letter page creation failed:", err);
      }
    }

    // 6f. Generate team CVs sub-page
    let teamCvsUrl: string | null = null;
    if (draft.teamMembersForCvs.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cvsPage = await notion.pages.create({ parent: { page_id: deal.id }, properties: { title: [{ type: "text", text: { content: `Team CVs — ${rfpName}` } }] } } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cvBlocks: any[] = [calloutBlock(`Team CVs for: ${rfpName}`, "👥"), divider()];
        for (const name of draft.teamMembersForCvs) {
          const bio = TEAM_BIOS[name];
          if (!bio) continue;
          cvBlocks.push(heading2(name), para(bio));
          const relevantAssets = bdAssetsResult.filter((a) => draft.relevantExperience.some((e) => e.assetId === a.id)).slice(0, 4);
          if (relevantAssets.length > 0) {
            cvBlocks.push(heading3("Selected Relevant Experience"));
            for (const asset of relevantAssets) {
              cvBlocks.push(bulletItem(`${asset.asset}${asset.description ? ` — ${asset.description.slice(0, 200)}` : ""}`));
            }
          }
          cvBlocks.push(divider());
        }
        await appendBlocks(cvsPage.id, cvBlocks);
        teamCvsUrl = notionUrl(cvsPage.id);
        rfpUpdates.teamCvsUrl = teamCvsUrl;
      } catch (err) {
        console.warn("[proposal] team CVs page creation failed:", err);
      }
    }

    updateRfpOpportunity(rfpId, rfpUpdates).catch(() => {});

    // 7. Slack summary
    const lines = [
      `📋 Proposal draft ready for review: *${rfpName}*`,
      org ? `🏢 ${org.organization}` : "",
      `📅 Due ${dueLabel}`,
      valueLabel ? `💰 ${valueLabel}` : "",
      ``,
      `<${dealUrl}|Open proposal draft in Notion →>`,
      coverLetterUrl ? `<${coverLetterUrl}|Cover letter →>` : "",
      teamCvsUrl ? `<${teamCvsUrl}|Team CVs →>` : "",
      ``,
      `_Review the draft, fill any flagged gaps, and mark complete when submission-ready._`,
    ];

    if (draft.clarifyingQuestions.length > 0) {
      lines.push("", "❓ *Questions to ask the client:*");
      draft.clarifyingQuestions.forEach((q) => lines.push(`• ${q}`));
    }
    if (draft.missingInfo.length > 0) {
      lines.push("", "🔍 *Gaps to fill before submitting:*");
      draft.missingInfo.forEach((m) => lines.push(`• ${m}`));
    }

    await postToSlack(lines.filter(Boolean).join("\n"));

    return { success: true, message: `proposal ready: ${dealUrl}` };
  },
);

// ── Proposal DLQ consumer ─────────────────────────────────────────────────────
// Replaces Inngest's generateProposalFailureHandler.
// Fires when wv-port-proposal-queue exhausts maxRetries → dead_letter_queue.

const proposalDlqConsumer = createQueueConsumer<RfpProposalJob>(
  async (payload, env) => {
    seedProcessEnv(env as unknown as Env);
    const { rfpId } = payload;
    console.warn(`[proposal-dlq] cleaning up stuck status for rfpId=${rfpId}`);

    await updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch((err) => {
      console.error("[proposal-dlq] could not reset proposalStatus:", err);
    });

    await postToSlack(
      `⚠️ Proposal generation timed out or failed permanently for RFP \`${rfpId}\`. ` +
      `Status reset to "failed" — you can retry from the RFP page.`,
    ).catch(() => {});

    return { success: true };
  },
);

// ── Timesheet consumer ────────────────────────────────────────────────────────
// Migrated from: port/lib/inngest/functions/timesheet-notifications.ts
//
// Original step.run() wrappers removed — each operation runs inline.

function formatHours(hours: number | null, minutes: number | null): string {
  const h = hours ?? 0;
  const m = minutes ?? 0;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const timesheetConsumer = createQueueConsumer<TimesheetStatusJob>(
  async (payload, env) => {
    seedProcessEnv(env as unknown as Env);
    const { timesheetId, newStatus, previousStatus, approverEmail } = payload;

    // 1. Fetch the timesheet
    const timesheet = await getTimesheet(timesheetId);

    // 2. Look up submitter
    const members = await getActiveMembers();
    const submitter = members.find((m) => timesheet.personIds.includes(m.id)) ?? null;
    const submitterName  = submitter?.name ?? "Unknown";
    const submitterEmail = submitter?.email;
    const entryLabel     = timesheet.entry || "Untitled entry";
    const hoursLabel     = formatHours(timesheet.hours, timesheet.minutes);
    const dateLabel      = formatDateShort(timesheet.dateAndTime?.start);

    // 3. Send email for key transitions
    if (submitterEmail && (newStatus === "approved" || newStatus === "draft")) {
      const isApproval = newStatus === "approved";
      const subject = isApproval
        ? `Timesheet approved: ${entryLabel} (${hoursLabel})`
        : `Timesheet returned: ${entryLabel}`;

      const html = buildTimesheetEmail({
        isApproval, entryLabel, hoursLabel, dateLabel,
        approverEmail, billable: timesheet.billable, explanation: timesheet.explanation,
      });

      const text = isApproval
        ? `Your timesheet "${entryLabel}" (${hoursLabel} on ${dateLabel}) has been approved by ${approverEmail}.`
        : `Your timesheet "${entryLabel}" has been returned to draft by ${approverEmail}. Please review and resubmit.`;

      await sendOutreachEmail({
        to: submitterEmail, subject, html, text,
        tags: [{ name: "type", value: "timesheet-notification" }, { name: "status", value: newStatus }],
      }).catch((err) => console.warn("[timesheet] email send failed:", err));
    }

    // 4. Post Slack summary
    const emojiMap: Record<string, string> = {
      approved: ":white_check_mark:", submitted: ":inbox_tray:",
      invoiced: ":receipt:", paid: ":moneybag:", draft: ":pencil2:",
    };
    const emoji      = emojiMap[newStatus] ?? ":arrows_counterclockwise:";
    const transition = previousStatus ? `${previousStatus} → ${newStatus}` : newStatus;

    await postToSlack(
      `${emoji} *Timesheet ${transition}*: ${entryLabel} (${hoursLabel}, ${dateLabel})\n` +
      `    _${submitterName}_ · ${timesheet.billable ? "billable" : "non-billable"}` +
      (approverEmail ? ` · by ${approverEmail}` : ""),
    );

    return { success: true, message: `notified ${submitterEmail ?? "no-email"}` };
  },
);

function buildTimesheetEmail(params: {
  isApproval: boolean; entryLabel: string; hoursLabel: string; dateLabel: string;
  approverEmail: string; billable: boolean; explanation: string;
}): string {
  const { isApproval, entryLabel, hoursLabel, dateLabel, approverEmail, billable, explanation } = params;
  const statusColor   = isApproval ? "#16a34a" : "#d97706";
  const statusLabel   = isApproval ? "Approved" : "Returned to Draft";
  const statusMessage = isApproval
    ? "Your timesheet entry has been approved."
    : "Your timesheet entry has been returned to draft. Please review and resubmit.";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="padding:24px 24px 0;">
      <div style="display:inline-block;padding:4px 12px;border-radius:99px;background:${statusColor}15;color:${statusColor};font-size:13px;font-weight:600;">${statusLabel}</div>
      <h2 style="margin:16px 0 4px;font-size:18px;color:#111827;">${entryLabel}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">${statusMessage}</p>
    </div>
    <div style="padding:0 24px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:8px 0;color:#6b7280;width:100px;">Hours</td><td style="padding:8px 0;color:#111827;font-weight:500;">${hoursLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Date</td><td style="padding:8px 0;color:#111827;">${dateLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Billable</td><td style="padding:8px 0;color:#111827;">${billable ? "Yes" : "No"}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">${isApproval ? "Approved by" : "Returned by"}</td><td style="padding:8px 0;color:#111827;">${approverEmail}</td></tr>
        ${explanation ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Notes</td><td style="padding:8px 0;color:#111827;">${explanation}</td></tr>` : ""}
      </table>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <a href="https://port.windedvertigo.com/work/time" style="color:#2563eb;font-size:13px;text-decoration:none;">View timesheets →</a>
    </div>
  </div>
</body>
</html>`.trim();
}

// ── RFP Document consumer ─────────────────────────────────────────────────────
// Migrated from: port/lib/inngest/functions/parse-rfp-questions.ts
//
// R2 upload uses native PORT_ASSETS binding instead of @aws-sdk/client-s3.
// Everything else is a direct port of the Inngest function.

async function extractQuestionsLocal(
  documentText: string,
  rfpName: string,
  rfpId: string,
): Promise<Array<{ number: string; text: string }>> {
  const anthropic = new Anthropic();
  const start = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You extract discrete evaluation questions from RFP/procurement documents.
Return ONLY valid JSON: an array of question objects.
Each object must have "number" (the question identifier, e.g. "1", "2a", "B") and "text" (the full question text).
Only include genuine questions or required response items — skip headings, instructions, and boilerplate.
If the document has no discrete questions, return an empty array [].`,
    messages: [{ role: "user", content: `Extract all discrete questions or required response items from this RFP: "${rfpName}"\n\nDocument:\n${documentText.slice(0, 6000)}` }],
  });

  const costUsd = (response.usage.input_tokens / 1_000_000) * 0.8 + (response.usage.output_tokens / 1_000_000) * 4.0;
  recordUsage({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), feature: "rfp-question-parse", model: "claude-haiku-4-5-20251001", inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costUsd, userId: rfpId, durationMs: Date.now() - start }).catch(() => {});

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  try { const m = raw.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : []; } catch { return []; }
}

async function matchAndDraftLocal(
  questions: Array<{ number: string; text: string }>,
  bdAssets: Array<{ id: string; name: string; type: string; description: string; tags: string[] }>,
  rfpName: string,
  rfpId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  if (questions.length === 0) return [];
  const anthropic = new Anthropic();
  const assetList  = bdAssets.map((a) => `ID:${a.id} | ${a.name} (${a.type}) | Tags: ${a.tags.join(", ")} | ${a.description?.slice(0, 150) ?? ""}`).join("\n");
  const questionList = questions.map((q) => `${q.number}. ${q.text}`).join("\n");
  const start = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: `You are a business development specialist for winded.vertigo — a learning design collective.
For each question, identify the 1-3 most relevant BD assets and draft a concise response (2-4 sentences).
The brand is "winded.vertigo" (lowercase). Write responses in first person "we/our".
Return ONLY valid JSON: an array matching the input question order.`,
    messages: [{ role: "user", content: `RFP: "${rfpName}"\n\nBD Assets available:\n${assetList}\n\nQuestions to match and draft:\n${questionList}\n\nReturn a JSON array with one object per question:\n[{\n  "number": "1",\n  "text": "original question text",\n  "suggestedAssets": [{ "assetId": "notion_page_id", "assetName": "name", "relevanceNote": "why" }],\n  "draftResponse": "2-4 sentence draft"\n}]` }],
  });

  const costUsd = (response.usage.input_tokens / 1_000_000) * 0.8 + (response.usage.output_tokens / 1_000_000) * 4.0;
  recordUsage({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), feature: "rfp-question-parse", model: "claude-haiku-4-5-20251001", inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costUsd, userId: rfpId, durationMs: Date.now() - start }).catch(() => {});

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  try { const m = raw.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : []; } catch { return []; }
}

const rfpDocumentConsumer = createQueueConsumer<RfpDocumentUploadedJob>(
  async (payload, env) => {
    seedProcessEnv(env as unknown as Env);
    const typedEnv = env as unknown as Env;
    const r2 = typedEnv.PORT_ASSETS;
    const r2PublicUrl = typedEnv.R2_PUBLIC_URL;
    const { rfpId, documentUrl, contentType } = payload;

    // 1. Fetch RFP + BD assets
    const [rfp, bdResult] = await Promise.all([
      getRfpOpportunity(rfpId).catch(() => null),
      queryBdAssets(undefined, { pageSize: 50 }).then((r) => r.data).catch(() => []),
    ]);

    if (!rfp) return { success: false, error: "rfp_not_found" };

    // 2. Get document text
    let documentText = "";

    if (contentType === "text/plain" && documentUrl.startsWith("http")) {
      try {
        const res = await fetch(documentUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) documentText = await res.text();
      } catch { /* fall through to snapshot */ }
    }

    if (!documentText && rfp.requirementsSnapshot) {
      documentText = rfp.requirementsSnapshot;
    }

    if (!documentText) return { success: false, error: "no_document_text" };

    // 3. Extract questions (Claude pass 1)
    const questions = await extractQuestionsLocal(documentText, rfp.opportunityName, rfpId);
    if (questions.length === 0) return { success: true, message: "no_questions_found" };

    // 4. Match to BD assets + draft (Claude pass 2)
    const bdAssets = bdResult.slice(0, 25).map((a) => ({
      id: a.id, name: a.asset, type: a.assetType,
      description: a.description ?? "", tags: a.tags ?? [],
    }));

    const entries = await matchAndDraftLocal(questions, bdAssets, rfp.opportunityName, rfpId);
    if (entries.length === 0) return { success: false, error: "matching_failed" };

    // 5. Store in R2 using native binding (not AWS SDK)
    const bank: QuestionBank = {
      rfpId, rfpName: rfp.opportunityName,
      generatedAt: new Date().toISOString(), questions: entries,
    };

    const key = `rfp-docs/${rfpId}/question-bank.json`;
    const body = JSON.stringify(bank, null, 2);
    await r2.put(key, body, { httpMetadata: { contentType: "application/json" } });
    const publicUrl = `${r2PublicUrl}/${key}`;

    // 6. Update Notion
    await updateRfpOpportunity(rfpId, {
      questionBankUrl: publicUrl,
      questionCount: entries.length,
    }).catch(() => {});

    return { success: true, message: `${entries.length} questions parsed` };
  },
);

// ── Worker export ─────────────────────────────────────────────────────────────

export default {
  async queue(
    batch: MessageBatch,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    switch (batch.queue) {
      case QUEUE_PROPOSAL:
        await proposalConsumer(batch as MessageBatch<RfpProposalJob>, env as unknown as Record<string, unknown>);
        break;

      case QUEUE_PROPOSAL_DLQ:
        await proposalDlqConsumer(batch as MessageBatch<RfpProposalJob>, env as unknown as Record<string, unknown>);
        break;

      case QUEUE_TIMESHEET:
        await timesheetConsumer(batch as MessageBatch<TimesheetStatusJob>, env as unknown as Record<string, unknown>);
        break;

      case QUEUE_RFP_DOCUMENT:
        await rfpDocumentConsumer(batch as MessageBatch<RfpDocumentUploadedJob>, env as unknown as Record<string, unknown>);
        break;

      default:
        console.error(`[port-jobs] unknown queue: ${batch.queue}`);
        // Ack all messages to avoid infinite retry on unknown queue
        batch.ackAll();
    }
  },
} satisfies ExportedHandler<Env>;

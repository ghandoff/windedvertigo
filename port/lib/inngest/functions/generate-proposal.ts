/**
 * Inngest background job: generate a proposal draft when an RFP moves to "pursuing".
 *
 * Steps:
 * 1. Fetch RFP record
 * 2. Validate required fields — post Slack warning and abort if missing
 * 3. Fetch org context, recent activities, BD assets, and bibliography in parallel
 * 4. Post Slack "sharpening" prompt if enriching fields are missing (but continue)
 * 4b. Fetch document requirements from R2 if available
 * 4c. Fetch question bank if available
 * 4d. Match bibliography citations to RFP topic via Claude
 * 5. Call Claude to generate a structured proposal draft
 * 6. Create a Deal record in Notion with the proposal content as page blocks
 * 6b. Generate cover letter Notion page if required
 * 6c. Generate team CVs Notion page if required
 * 7. Post Slack summary with a link to the Notion deal page
 */

import { inngest } from "@/lib/inngest/client";
import { getRfpOpportunity, updateRfpOpportunity } from "@/lib/notion/rfp-radar";
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

const CRM_BASE_URL = "https://port.windedvertigo.com";

// ── helpers ───────────────────────────────────────────────

function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Build Notion rich text blocks
function para(text: string) {
  return {
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: text.slice(0, 2000) } }],
    },
  };
}

function heading1(text: string) {
  return {
    object: "block" as const,
    type: "heading_1" as const,
    heading_1: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function heading2(text: string) {
  return {
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function heading3(text: string) {
  return {
    object: "block" as const,
    type: "heading_3" as const,
    heading_3: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function bulletItem(text: string) {
  return {
    object: "block" as const,
    type: "bulleted_list_item" as const,
    bulleted_list_item: {
      rich_text: [{ type: "text" as const, text: { content: text.slice(0, 2000) } }],
    },
  };
}

function calloutBlock(text: string, emoji: string) {
  return {
    object: "block" as const,
    type: "callout" as const,
    callout: {
      rich_text: [{ type: "text" as const, text: { content: text.slice(0, 2000) } }],
      icon: { type: "emoji" as const, emoji },
    },
  };
}

function divider() {
  return { object: "block" as const, type: "divider" as const, divider: {} };
}

/**
 * Split a prose section that may contain "🎨 Visual aide:" markers into
 * an array of Notion blocks — paragraphs for prose, callouts for visual aides.
 * Chunks long text at paragraph boundaries to stay under the 2000-char limit.
 */
function sectionToBlocks(text: string): ReturnType<typeof para | typeof calloutBlock>[] {
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
      // Split on paragraph breaks, chunk at 1800 chars
      const paragraphs = trimmed.split(/\n{2,}/);
      for (const p of paragraphs) {
        const chunk = p.trim();
        if (!chunk) continue;
        if (chunk.length <= 1800) {
          blocks.push(para(chunk));
        } else {
          // Hard-split at sentence boundaries
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

async function appendBlocks(pageId: string, blocks: object[]): Promise<void> {
  const CHUNK_SIZE = 90;
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + CHUNK_SIZE) as Parameters<typeof notion.blocks.children.append>[0]["children"],
    });
  }
}

// ── function ──────────────────────────────────────────────

// ── onFailure handler ─────────────────────────────────────
// Called by Inngest when the function exhausts all retries (including timeout).
// Sets proposalStatus back to "failed" so the UI escape hatch can fire.
export const generateProposalFailureHandler = inngest.createFunction(
  {
    id: "generate-proposal-failure",
    name: "Generate Proposal — Failure Cleanup",
    triggers: [{ event: "inngest/function.failed" as const }],
  },
  async ({ event }: { event: { data: { function_id: string; event: { data: { rfpId: string } } } } }) => {
    if (event.data.function_id !== "generate-proposal") return;
    const { rfpId } = event.data.event.data;
    console.warn(`[generate-proposal-failure] cleaning up stuck status for rfpId=${rfpId}`);
    await updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch((err) => {
      console.error("[generate-proposal-failure] could not reset proposalStatus:", err);
    });
    await postToSlack(
      `⚠️ Proposal generation timed out or failed permanently for RFP \`${rfpId}\`. Status reset to "failed" — you can retry from the RFP page.`,
    ).catch(() => {});
  },
);

export const generateProposalFunction = inngest.createFunction(
  {
    id: "generate-proposal",
    name: "Generate Proposal Draft",
    retries: 1,
    // Allow up to 8 minutes — Claude Sonnet with 8192 max tokens + Notion writes
    // can take 3-4 minutes; the default 2.5m Inngest timeout is too short.
    timeouts: { finish: "8m" },
    triggers: [{ event: "rfp/pursuing.triggered" as const }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: { data: { rfpId: string; triggeredBy: string } }; step: any }) => {
    const { rfpId, triggeredBy } = event.data;

    // ── Step 1: fetch RFP ─────────────────────────────────
    let rfp;
    try {
      rfp = await getRfpOpportunity(rfpId);
    } catch (err) {
      console.error("[generate-proposal] failed to fetch RFP:", err);
      await postToSlack(`⚠️ Proposal generation failed for RFP \`${rfpId}\` — could not fetch record from Notion.`);
      return { ok: false, reason: "rfp_not_found" };
    }

    updateRfpOpportunity(rfpId, { proposalStatus: "generating" }).catch(() => {});

    const rfpName = rfp.opportunityName || "Unnamed RFP";

    // ── Step 2: validate required fields ─────────────────
    const missingRequired: string[] = [];
    if (!rfp.dueDate?.start) missingRequired.push("due date");
    if (!rfp.opportunityType && !rfp.url && rfpName === "Unnamed RFP") {
      missingRequired.push("opportunity type or URL");
    }

    if (missingRequired.length > 0) {
      updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch(() => {});
      await postToSlack(
        `⚠️ *${rfpName}* moved to pursuing but is missing info needed for proposal generation.\n\nPlease add the following to the Notion record:\n${missingRequired.map((f) => `• ${f}`).join("\n")}\n\nGeneration will not proceed until these are added.`,
      );
      return { ok: false, reason: "missing_required_fields", missing: missingRequired };
    }

    // ── Step 3: parallel data fetch ───────────────────────
    const orgId = rfp.organizationIds?.[0] ?? null;

    // Infer funder type from source or org type for rate reference lookup
    const rfpGeo = rfp.geography?.[0] ?? undefined;
    const funderTypeMap: Record<string, string> = {
      "UN System": "UN System",
      IDB: "IDB",
      USAID: "USAID",
    };
    const inferredFunderType =
      rfp.source === "Email Alert" || rfp.source === "Manual Entry"
        ? undefined
        : (Object.keys(funderTypeMap).find((k) => rfp.opportunityName?.toLowerCase().includes(k.toLowerCase()))
            ?? undefined);

    const [org, activities, bdAssetsResult, allCitations, rateRefs] = await Promise.all([
      orgId ? getOrganization(orgId).catch(() => null) : Promise.resolve(null),
      orgId ? getActivitiesForOrg(orgId).then((r) => r.data).catch(() => []) : Promise.resolve([]),
      queryBdAssets(undefined, { pageSize: 50 }).then((r) => r.data).catch(() => []),
      queryBibliography().catch(() => []),
      queryRateReference({ funderType: inferredFunderType, geography: rfpGeo }).catch(() => []),
    ]);

    // ── Step 4: note missing enriching fields (but continue) ──
    const missingEnriching: string[] = [];
    if (!rfp.estimatedValue) missingEnriching.push("estimated contract value");
    if (!rfp.serviceMatch?.length) missingEnriching.push("service match");
    if (!rfp.requirementsSnapshot) missingEnriching.push("requirements snapshot");

    if (missingEnriching.length > 0) {
      postToSlack(
        `🎯 *${rfpName}* moved to *pursuing* — generating a proposal draft now.\n\nA few details would sharpen the output:\n${missingEnriching.map((f) => `• ${f}`).join("\n")}\n\nUpdate the <${CRM_BASE_URL}/rfp-radar|RFP Lighthouse record> anytime — the draft will flag gaps for you to fill.`,
      ).catch(() => {});
    }

    // ── Step 4b: fetch document requirements ─────────────
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

    // ── Step 4c: fetch question bank ──────────────────────
    let questionBank: QuestionBank | null = null;
    if (rfp.questionBankUrl && rfp.questionBankUrl.startsWith("http")) {
      try {
        const qbRes = await fetch(rfp.questionBankUrl, { signal: AbortSignal.timeout(10000) });
        if (qbRes.ok) questionBank = await qbRes.json() as QuestionBank;
      } catch { /* non-fatal */ }
    }

    // ── Step 4d: match bibliography citations ─────────────
    let relevantCitations = null;
    if (allCitations.length > 0) {
      relevantCitations = await matchCitations({
        rfp,
        allCitations,
        userId: triggeredBy,
      }).catch(() => null);
    }

    // ── Step 5: generate proposal draft ──────────────────
    // Wrapped in step.run() so Inngest can checkpoint and retry just this
    // expensive Claude call if it times out, without restarting from step 1.
    let draft: import("@/lib/ai/proposal-generator").ProposalDraft;
    try {
      draft = await step.run("generate-draft", () =>
        generateProposal({
          rfp,
          org,
          recentActivities: activities,
          bdAssets: bdAssetsResult,
          userId: triggeredBy,
          documentRequirements,
          questionBank,
          relevantCitations,
          rateRefs: rateRefs.length > 0 ? rateRefs : null,
        }),
      );
    } catch (err) {
      console.error("[generate-proposal] Claude generation failed:", err);
      updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch(() => {});
      await postToSlack(`⚠️ Proposal draft generation failed for *${rfpName}*. The AI call encountered an error. Please try again or draft manually.`);
      return { ok: false, reason: "generation_failed" };
    }

    // ── Step 6: create Deal in Notion ─────────────────────
    const dueLabel = formatDate(rfp.dueDate?.start);
    const valueLabel = rfp.estimatedValue
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rfp.estimatedValue)
      : null;

    const dealTitle = `${rfpName}${org ? ` — ${org.organization}` : ""}`;

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
      console.error("[generate-proposal] failed to create Deal:", err);
      updateRfpOpportunity(rfpId, { proposalStatus: "failed" }).catch(() => {});
      await postToSlack(`⚠️ Proposal draft was generated for *${rfpName}* but could not create a Deal record in Notion. Check logs.`);
      return { ok: false, reason: "deal_creation_failed" };
    }

    // ── Step 6b: append proposal content as page blocks ──
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

      heading1("Executive Summary"),
      ...sectionToBlocks(draft.executiveSummary),
      divider(),

      heading1("Understanding of Requirements"),
      ...sectionToBlocks(draft.understandingOfRequirements),
      divider(),

      heading1("Proposed Approach"),
      ...sectionToBlocks(draft.proposedApproach),
      divider(),

      heading1("Relevant Experience"),
      ...draft.relevantExperience.flatMap((exp) => [
        heading3(exp.project),
        ...sectionToBlocks(exp.relevance),
      ]),
      divider(),

      heading1("Team Composition"),
      ...sectionToBlocks(draft.teamComposition),
      divider(),

      heading1("Value Proposition"),
      ...sectionToBlocks(draft.valueProposition),
      divider(),

      heading1("Budget Framework"),
      ...sectionToBlocks(draft.budgetFramework),
      divider(),

      heading1("Risk Mitigation"),
      ...sectionToBlocks(draft.riskMitigation),
    ];

    if (draft.clarifyingQuestions.length > 0) {
      blocks.push(
        divider(),
        heading2("❓ Clarifying Questions for Client"),
        ...draft.clarifyingQuestions.map((q) => bulletItem(q)),
      );
    }

    if (draft.missingInfo.length > 0) {
      blocks.push(
        divider(),
        heading2("🔍 Gaps to Fill Before Submitting"),
        ...draft.missingInfo.map((m) => para(m)),
      );
    }

    if (draft.references.length > 0) {
      blocks.push(
        divider(),
        heading2("References"),
        ...draft.references.map((r) => para(r)),
      );
    }

    try {
      await appendBlocks(deal.id, blocks);
    } catch (err) {
      console.warn("[generate-proposal] block append failed:", err);
    }

    // ── Step 6c: write proposal status back to RFP ───────
    const dealUrl = notionUrl(deal.id);
    const rfpUpdates: Parameters<typeof updateRfpOpportunity>[1] = {
      proposalStatus: "ready-for-review",
      proposalDraftUrl: dealUrl,
    };

    // ── Step 6d: increment timesUsed on cited BD assets ──
    const citedAssetIds = draft.relevantExperience
      .map((e) => e.assetId)
      .filter((id): id is string => !!id);

    if (citedAssetIds.length > 0) {
      await Promise.all(citedAssetIds.map((id) => incrementBdAssetUsage(id).catch(() => {})));
    }

    // ── Step 6e: generate cover letter page ──────────────
    let coverLetterUrl: string | null = null;
    if (draft.requiresCoverLetter && draft.coverLetter) {
      try {
        const clPage = await notion.pages.create({
          parent: { page_id: deal.id },
          properties: {
            title: [{ type: "text", text: { content: `Cover Letter — ${rfpName}` } }],
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        const clBlocks = [
          calloutBlock(`Cover letter for: ${rfpName}\nDue: ${dueLabel}`, "📬"),
          divider(),
          ...sectionToBlocks(draft.coverLetter),
        ];
        await appendBlocks(clPage.id, clBlocks);
        coverLetterUrl = notionUrl(clPage.id);
        rfpUpdates.coverLetterUrl = coverLetterUrl;
      } catch (err) {
        console.warn("[generate-proposal] cover letter page creation failed:", err);
      }
    }

    // ── Step 6f: generate team CVs page ──────────────────
    let teamCvsUrl: string | null = null;
    if (draft.teamMembersForCvs.length > 0) {
      try {
        const cvsPage = await notion.pages.create({
          parent: { page_id: deal.id },
          properties: {
            title: [{ type: "text", text: { content: `Team CVs — ${rfpName}` } }],
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cvBlocks: any[] = [
          calloutBlock(`Team CVs for: ${rfpName}`, "👥"),
          divider(),
        ];

        for (const name of draft.teamMembersForCvs) {
          const bio = TEAM_BIOS[name];
          if (!bio) continue;
          cvBlocks.push(heading2(name));
          cvBlocks.push(para(bio));

          // Add relevant BD asset experience for this team member
          const relevantAssets = bdAssetsResult
            .filter((a) => draft.relevantExperience.some((e) => e.assetId === a.id))
            .slice(0, 4);

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
        console.warn("[generate-proposal] team CVs page creation failed:", err);
      }
    }

    updateRfpOpportunity(rfpId, rfpUpdates).catch(() => {});

    // ── Step 7: Slack summary ─────────────────────────────
    const lines: string[] = [
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
      lines.push(``, `❓ *Questions to ask the client:*`);
      draft.clarifyingQuestions.forEach((q) => lines.push(`• ${q}`));
    }

    if (draft.missingInfo.length > 0) {
      lines.push(``, `🔍 *Gaps to fill before submitting:*`);
      draft.missingInfo.forEach((m) => lines.push(`• ${m}`));
    }

    await postToSlack(lines.filter(Boolean).join("\n"));

    return { ok: true, dealId: deal.id, rfpId, rfpName, coverLetterUrl, teamCvsUrl };
  },
);

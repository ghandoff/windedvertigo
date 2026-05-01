/**
 * Inngest background job: RFP Question Set Parser.
 *
 * Triggered when an RFP document is uploaded (rfp/document.uploaded).
 *
 * Steps:
 * 1. Fetch the RFP record + BD assets
 * 2. Fetch document text from R2 (TXT) or use requirementsSnapshot (PDF fallback)
 * 3. Claude pass 1 — extract discrete numbered/lettered questions from document
 * 4. Claude pass 2 — match each question to relevant BD assets + draft short response
 * 5. Store question bank JSON in R2
 * 6. Update Notion record: questionBankUrl + questionCount
 */

import Anthropic from "@anthropic-ai/sdk";
import { inngest } from "@/lib/inngest/client";
import { getRfpOpportunity, updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { queryBdAssets } from "@/lib/notion/bd-assets";
import { uploadAsset } from "@/lib/r2/upload";
import { recordUsage } from "@/lib/ai/usage-store";

const anthropic = new Anthropic();

// ── types ─────────────────────────────────────────────────

export interface QuestionBankEntry {
  number: string;
  text: string;
  suggestedAssets: Array<{
    assetId: string;
    assetName: string;
    relevanceNote: string;
  }>;
  draftResponse: string;
}

export interface QuestionBank {
  rfpId: string;
  rfpName: string;
  generatedAt: string;
  questions: QuestionBankEntry[];
}

// ── helpers ───────────────────────────────────────────────

async function trackUsage(
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
  userId: string,
) {
  const costUsd = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;
  await recordUsage({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    feature: "rfp-question-parse",
    model: "claude-haiku-4-5-20251001",
    inputTokens,
    outputTokens,
    costUsd,
    userId,
    durationMs,
  }).catch(() => {});
}

// ── Claude pass 1: extract questions ─────────────────────

async function extractQuestions(
  documentText: string,
  rfpName: string,
  userId: string,
): Promise<Array<{ number: string; text: string }>> {
  const start = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You extract discrete evaluation questions from RFP/procurement documents.
Return ONLY valid JSON: an array of question objects.
Each object must have "number" (the question identifier, e.g. "1", "2a", "B") and "text" (the full question text).
Only include genuine questions or required response items — skip headings, instructions, and boilerplate.
If the document has no discrete questions, return an empty array [].`,
    messages: [{
      role: "user",
      content: `Extract all discrete questions or required response items from this RFP: "${rfpName}"\n\nDocument:\n${documentText.slice(0, 6000)}`,
    }],
  });

  trackUsage(response.usage.input_tokens, response.usage.output_tokens, Date.now() - start, userId);

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

// ── Claude pass 2: match + draft ─────────────────────────

async function matchAndDraft(
  questions: Array<{ number: string; text: string }>,
  bdAssets: Array<{ id: string; name: string; type: string; description: string; tags: string[] }>,
  rfpName: string,
  userId: string,
): Promise<QuestionBankEntry[]> {
  if (questions.length === 0) return [];

  const assetList = bdAssets.map((a) =>
    `ID:${a.id} | ${a.name} (${a.type}) | Tags: ${a.tags.join(", ")} | ${a.description?.slice(0, 150) ?? ""}`,
  ).join("\n");

  const questionList = questions.map((q) => `${q.number}. ${q.text}`).join("\n");

  const start = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: `You are a business development specialist for winded.vertigo — a learning design collective.
For each question, identify the 1-3 most relevant BD assets and draft a concise response (2-4 sentences).
The brand is "winded.vertigo" (lowercase). Write responses in first person "we/our".
Return ONLY valid JSON: an array matching the input question order.`,
    messages: [{
      role: "user",
      content: `RFP: "${rfpName}"

BD Assets available:
${assetList}

Questions to match and draft:
${questionList}

Return a JSON array with one object per question:
[
  {
    "number": "1",
    "text": "original question text",
    "suggestedAssets": [
      { "assetId": "notion_page_id", "assetName": "name", "relevanceNote": "why this asset helps answer this question" }
    ],
    "draftResponse": "2-4 sentence draft answer in winded.vertigo voice"
  }
]`,
    }],
  });

  trackUsage(response.usage.input_tokens, response.usage.output_tokens, Date.now() - start, userId);

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

// ── function ──────────────────────────────────────────────

export const parseRfpQuestionsFunction = inngest.createFunction(
  {
    id: "parse-rfp-questions",
    name: "Parse RFP Question Set",
    retries: 1,
    triggers: [{ event: "rfp/document.uploaded" as const }],
  },
  async ({ event }: { event: { data: { rfpId: string; documentUrl: string; contentType: string } } }) => {
    const { rfpId, documentUrl, contentType } = event.data;

    // ── Step 1: fetch RFP + BD assets ───────────────────
    const [rfp, bdResult] = await Promise.all([
      getRfpOpportunity(rfpId).catch(() => null),
      queryBdAssets(undefined, { pageSize: 50 }).then((r) => r.data).catch(() => []),
    ]);

    if (!rfp) return { ok: false, reason: "rfp_not_found" };

    // ── Step 2: get document text ────────────────────────
    let documentText = "";

    if (contentType === "text/plain" && documentUrl.startsWith("http")) {
      try {
        const res = await fetch(documentUrl, { signal: AbortSignal.timeout(15000) });
        if (res.ok) documentText = await res.text();
      } catch { /* fall through to snapshot */ }
    }

    // For PDFs or failed fetches, fall back to the requirements snapshot
    if (!documentText && rfp.requirementsSnapshot) {
      documentText = rfp.requirementsSnapshot;
    }

    if (!documentText) return { ok: false, reason: "no_document_text" };

    // ── Step 3: extract questions ─────────────────────
    const questions = await extractQuestions(documentText, rfp.opportunityName, rfpId);
    if (questions.length === 0) return { ok: true, questionCount: 0, reason: "no_questions_found" };

    // ── Step 4: match to BD assets + draft ────────────
    const bdAssets = bdResult.slice(0, 25).map((a) => ({
      id: a.id,
      name: a.asset,
      type: a.assetType,
      description: a.description ?? "",
      tags: a.tags ?? [],
    }));

    const entries = await matchAndDraft(questions, bdAssets, rfp.opportunityName, rfpId);
    if (entries.length === 0) return { ok: false, reason: "matching_failed" };

    // ── Step 5: store in R2 ────────────────────────────
    const bank: QuestionBank = {
      rfpId,
      rfpName: rfp.opportunityName,
      generatedAt: new Date().toISOString(),
      questions: entries,
    };

    const key = `rfp-docs/${rfpId}/question-bank.json`;
    const publicUrl = await uploadAsset(
      Buffer.from(JSON.stringify(bank, null, 2)),
      key,
      "application/json",
    );

    // ── Step 6: update Notion ──────────────────────────
    await updateRfpOpportunity(rfpId, {
      questionBankUrl: publicUrl,
      questionCount: entries.length,
    }).catch(() => {});

    return { ok: true, questionCount: entries.length, url: publicUrl };
  },
);

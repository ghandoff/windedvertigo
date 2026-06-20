/**
 * Requirement extractor — Pass 2 of the RFP intake AI pipeline.
 *
 * Pass 1 (existing, in port-jobs/src/index.ts `extractQuestionsLocal`) finds
 * the discrete numbered questions/items in a TOR — useful but flat.
 *
 * Pass 2 (this file) does the structured-requirements extraction the rest of
 * the system depends on:
 *   - Classify into one of 5 kinds: deliverable, eligibility,
 *     evaluation_criterion, admin, submission
 *   - For deliverables, pull page_limit, word_limit, format, required_sections
 *   - For evaluation_criteria, pull weight_pct
 *   - For every row, capture a source_quote (verification anchor)
 *
 * The output drives:
 *   - the verification gate UI (human approves rows before generation)
 *   - the parameter-aware proposal generator (knows exactly which deliverables
 *     to produce and to what spec — fixes the "Oxfam needed 4 docs, AI made 3"
 *     class of bug)
 *   - the rfp_coverage view (compliance matrix)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { NewRequirement, RequirementKind } from "@/lib/supabase/rfp-requirements";

const MODEL = "claude-haiku-4-5-20251001";
const SYSTEM_PROMPT = `You extract structured requirements from RFP / TOR documents into a typed list.

Return ONLY valid JSON: an array of requirement objects. No prose, no markdown fences.

Each requirement object MUST have:
  "kind":   one of "deliverable" | "eligibility" | "evaluation_criterion" | "admin" | "submission"
  "label":  short noun-phrase title (≤80 chars). e.g. "Expression of Interest", "PhD in education or related"
  "description": 1-2 sentence elaboration (optional, can be omitted)
  "source_quote": the exact verbatim sentence/clause from the TOR that this row was extracted from (≤500 chars). REQUIRED — this is the verification anchor.
  "extraction_confidence": 0.0 to 1.0 — your confidence the row is correctly extracted

For "deliverable" rows, ALSO include when known:
  "page_limit":  integer (e.g. 2 from "no more than 2 pages")
  "word_limit":  integer (e.g. 500)
  "format":      "pdf" | "docx" | "either" — what the RFP requires for the file
  "required_sections": array of section names the deliverable must contain
                       e.g. ["Track record", "Summary of evidence", "Profile of organization"]

For "evaluation_criterion" rows, ALSO include when known:
  "weight_pct":  number — the percentage weight in scoring (e.g. 30 from "30%")

Kind taxonomy:
  - deliverable: a document the bidder must SUBMIT. Examples: "Technical proposal", "Expression of Interest",
    "Cover letter", "CVs of key personnel", "Detailed financial proposal in USD", "Compliance certificates".
  - eligibility: a constraint on WHO can bid. Examples: "Must be a registered NGO", "Minimum 5 years experience",
    "Local presence in country X", "PhD-level lead researcher".
  - evaluation_criterion: a SCORING dimension. Examples: "Methodology — 30%", "Past performance — 25%",
    "Cost — 20%", "Team composition — 15%".
  - admin: a procedural requirement. Examples: "Use template attached as Annex B", "Sign and stamp every page",
    "Reference RFP number RFPS-NYH-2026-503915 in subject line", "All currency in USD".
  - submission: HOW to submit. Examples: "Email to procurement@org with subject [RFP-XYZ]",
    "Submit via portal at https://...", "Hard copy to address X by date Y".

CRITICAL extraction rules:
  - When the TOR has an enumerated "Application process" or "Required documents" section, EVERY listed item is a separate "deliverable" row. Do NOT merge.
  - Pull page/word limits from phrases like "no more than 2 pages", "maximum 500 words", "5-page limit", "≤10 pages".
  - Pull required sections from sub-bullets that elaborate what a deliverable must contain.
  - If the same constraint appears multiple times in the TOR, only emit ONE row.
  - If unsure of kind, default to "admin".
  - Skip purely descriptive prose (background, context) — only extract things the bidder must DO or PROVIDE.
  - Do NOT invent requirements. If the TOR is silent on something, it's not a requirement.

If the document has no extractable requirements, return [].`;

export interface ExtractedRequirement {
  kind: RequirementKind;
  label: string;
  description?: string;
  source_quote: string;
  extraction_confidence?: number;
  page_limit?: number;
  word_limit?: number;
  format?: "pdf" | "docx" | "either";
  required_sections?: string[];
  weight_pct?: number;
}

export interface ExtractRequirementsOptions {
  documentText: string;
  rfpName: string;
  /** Used as `userId` for usage-store recording. */
  rfpId: string;
}

export interface ExtractRequirementsResult {
  requirements: ExtractedRequirement[];
  /** Convenience: ready-to-insert NewRequirement[] (caller passes rfpId again to fix rfpId field). */
  toNewRequirements(rfpId: string): NewRequirement[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

/** Conservative cost-per-million for haiku-4-5: $0.80 input / $4 output. */
const HAIKU_COST_INPUT  = 0.8;
const HAIKU_COST_OUTPUT = 4.0;

/**
 * Run Pass-2 extraction on a TOR document. Returns structured requirements
 * plus token/cost metadata for usage tracking.
 */
export async function extractRequirements(
  opts: ExtractRequirementsOptions,
): Promise<ExtractRequirementsResult> {
  const anthropic = new Anthropic();
  const start = Date.now();

  // Truncate input to ~8000 chars to bound cost. Most TORs fit comfortably; the
  // very large ones (UNICEF Global LTAS class) get the front matter + procedure
  // sections, which is where requirements live anyway.
  const trimmedText = opts.documentText.slice(0, 8000);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `RFP name: "${opts.rfpName}"\n\n` +
          `TOR / RFP document text (may be truncated to first 8000 chars):\n\n` +
          trimmedText +
          `\n\nExtract all requirements per the schema in the system prompt. Return ONLY the JSON array.`,
      },
    ],
  });

  return buildResult(response, start);
}

export interface ExtractRequirementsFromPdfOptions {
  pdfBuffer: Buffer;
  rfpName: string;
  rfpId: string;
}

/** PDF variant — uses Anthropic's document block API so PDFs are read natively. */
export async function extractRequirementsFromPdf(
  opts: ExtractRequirementsFromPdfOptions,
): Promise<ExtractRequirementsResult> {
  const anthropic = new Anthropic();
  const start = Date.now();
  const base64 = opts.pdfBuffer.toString("base64");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: `RFP name: "${opts.rfpName}"\n\nExtract all requirements per the schema in the system prompt. Return ONLY the JSON array.`,
          },
        ],
      },
    ],
  });

  return buildResult(response, start);
}

function buildResult(response: Anthropic.Message, start: number): ExtractRequirementsResult {

  const durationMs = Date.now() - start;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd =
    (inputTokens / 1_000_000) * HAIKU_COST_INPUT +
    (outputTokens / 1_000_000) * HAIKU_COST_OUTPUT;

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "[]";
  let parsed: ExtractedRequirement[] = [];
  try {
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    parsed = arrayMatch ? (JSON.parse(arrayMatch[0]) as ExtractedRequirement[]) : [];
  } catch (err) {
    console.warn("[rfp-requirements-extractor] JSON parse failed:", err);
    parsed = [];
  }

  // Defensive cleaning — drop rows missing the required fields.
  const valid = parsed.filter(
    (r) =>
      typeof r.kind === "string" &&
      typeof r.label === "string" &&
      r.label.length > 0 &&
      typeof r.source_quote === "string",
  );

  return {
    requirements: valid,
    inputTokens,
    outputTokens,
    costUsd,
    durationMs,
    toNewRequirements(rfpId: string): NewRequirement[] {
      return valid.map((r) => ({
        rfpId,
        kind: r.kind,
        label: r.label.slice(0, 200),
        description: r.description?.slice(0, 1000) ?? null,
        pageLimit: r.page_limit ?? null,
        wordLimit: r.word_limit ?? null,
        format: r.format ?? null,
        requiredSections: r.required_sections ?? [],
        weightPct: r.weight_pct ?? null,
        required: true,
        extractedBy: `claude:${MODEL}`,
        extractionConfidence: typeof r.extraction_confidence === "number" ? r.extraction_confidence : null,
        sourceQuote: r.source_quote.slice(0, 500),
      }));
    },
  };
}

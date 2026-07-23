/**
 * Biz value extraction — estimate an RFP's total contract/grant value (USD)
 * from its one-pager summary, so the weighted-pipeline-coverage number has
 * data to work with.
 *
 * `estimated_value` is a manual Notion field the RFP ingest never fills, so
 * it's null on ~every active opportunity. This proposes a value; a human
 * confirms it via the spine preview card, and on approve the intervention
 * executor writes it back to Notion (updateRfpOpportunity) — Notion stays the
 * source of truth, the hourly sync then flows it to Supabase.
 *
 * Haiku (`rfp-document-extraction` feature) — cheap structured extraction.
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";

export interface ValueProposal {
  /** Total contract/grant value in USD, or null when there's no basis to estimate. */
  value: number | null;
  /** One short sentence of rationale. */
  basis: string;
  confidence: "low" | "medium" | "high";
}

const SYSTEM =
  "You estimate the total contract or grant budget in USD for a funding opportunity / RFP, " +
  "from the summary provided. Return the single most-likely total value as a plain number in " +
  "USD (no currency symbol, no commas, no ranges). If the summary states or clearly implies a " +
  "budget, use it. Otherwise infer an order-of-magnitude estimate from the scope, duration, and " +
  "funder type, and set confidence to low. If there is genuinely no basis at all to estimate, " +
  'return value null. Respond with strict JSON only: {"value": <number|null>, "basis": "<one ' +
  'short sentence>", "confidence": "low|medium|high"}';

/** Propose an estimated value from the RFP name + one-pager. Fails soft (null). */
export async function proposeEstimatedValue(
  name: string,
  onePager: unknown,
): Promise<ValueProposal | null> {
  const text = typeof onePager === "string" ? onePager : JSON.stringify(onePager ?? {});
  const userMessage = `Opportunity: ${name}\n\nSummary:\n${text.slice(0, 6000)}`;
  try {
    const result = await callClaude({
      feature: "rfp-document-extraction",
      system: SYSTEM,
      userMessage,
      userId: "ambient:biz",
      maxTokens: 200,
    });
    const parsed = parseJsonResponse<ValueProposal>(result.text);
    if (!parsed) return null;
    // Guard: only accept a finite positive number, else treat as "no basis".
    if (typeof parsed.value !== "number" || !Number.isFinite(parsed.value) || parsed.value <= 0) {
      parsed.value = null;
    }
    return parsed;
  } catch (err) {
    console.warn("[biz/value-extract] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

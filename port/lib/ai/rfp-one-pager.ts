/**
 * RFP one-pager — the cheap review brief generated at intake for every grant.
 *
 * This is the collective-review preprocessing step from the 2026-07 meetings:
 * instead of spending 12k tokens drafting a full proposal the moment a card is
 * pursued, every incoming grant gets a lightweight Haiku brief the team can scan
 * (and which "pursuing" surfaces as a "glance"). Fail-open: any error returns
 * null so ingest never breaks.
 *
 * Mirrors lib/ai/rfp-triage.ts (cheap single Haiku call + parseJsonResponse),
 * NOT the streaming 12k-token lib/ai/proposal-generator.ts.
 */

import { callClaude, parseJsonResponse } from "./client";
import { WV_PROFILE } from "./wv-profile";
import type { OnePager } from "@/lib/notion/types";

export interface OnePagerInput {
  opportunityName: string;
  /** Triage's 2–3 sentence summary of what work is sought. */
  requirementsSnapshot?: string;
  /** Triage's fit rationale — helps the "why apply" framing. */
  decisionNotes?: string;
  /** Raw TOR / announcement text (the richest source; truncated internally). */
  torText?: string;
  /** URL the opportunity/TOR came from (for the model's context only). */
  torUrl?: string;
  source?: string;
  geography?: string[];
  serviceMatch?: string[];
  /**
   * What text the caller is actually supplying — set the provenance HONESTLY so
   * the brief is calibrated and never over-trusted. Not model-inferred.
   */
  sourceBasis: OnePager["sourceBasis"];
}

const SOURCE_BASIS_GUIDANCE: Record<OnePager["sourceBasis"], string> = {
  "verified-tor":
    "The text below is a human-VERIFIED full Terms of Reference. You may rely on it.",
  "unverified-tor-doc":
    "The text below appears to be a TOR document but has NOT been human-verified — ground every claim in it and flag anything ambiguous.",
  "description-only":
    "The text below is only an aggregator LISTING/DESCRIPTION, NOT a full TOR. Do NOT infer deliverables, conditions, or requirements that are not explicitly stated — leave those arrays empty rather than guessing, keep eligibility 'uncertain' unless a hard fact is knowable, and make clear in itemsToVerify that the real TOR must be located and read.",
};

export interface OnePagerResult {
  onePager: OnePager;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

/** Collapse whitespace and cap length so the brief call stays cheap. */
function truncate(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

const VALID_ELIGIBILITY = ["likely-eligible", "likely-ineligible", "uncertain"] as const;

/**
 * Generate a structured one-pager brief for a grant. Composes from the
 * already-extracted triage snapshot + whatever TOR text is available at intake —
 * does NOT re-fetch. Returns null on any failure (fail-open).
 */
export async function generateOnePager(
  input: OnePagerInput,
): Promise<OnePagerResult | null> {
  const logPrefix = "[rfp-one-pager]";
  try {
    // Prefer the raw TOR text (richest); fall back to the triage snapshot.
    const torText = input.torText ? truncate(input.torText, 8000) : "";
    const snapshot = input.requirementsSnapshot?.trim() ?? "";
    if (!torText && !snapshot) {
      console.log(`${logPrefix} no TOR text or snapshot for ${input.opportunityName}, skipping`);
      return null;
    }

    const systemPrompt = `You are a bid-review analyst for winded.vertigo (w.v).

${WV_PROFILE}

Your task: read a grant/RFP and produce a concise ONE-PAGER the collective can review in under a minute — so a human can give early feedback and decide whether to pursue BEFORE any full proposal is drafted. Be specific and honest; if the fit or eligibility is weak, say so plainly.

GROUNDING (critical — no hallucination): ${SOURCE_BASIS_GUIDANCE[input.sourceBasis]} Never invent facts, deliverables, budgets, timelines, or requirements that are not present in the provided text. If something is not stated, leave the field out (empty array / brief note) rather than guessing — an honest gap is far more useful than a plausible fabrication.

Also judge whether the provided text is a FULL Terms of Reference (background, scope, deliverables, timeline, eligibility, submission requirements) or merely an announcement/website snippet linking to one — set "torIsReal" accordingly.

Return ONLY valid JSON — no prose, no markdown fences — matching this exact schema:
{
  "summary": string (2-3 sentences: what the grant is about),
  "whyApply": string (1-2 sentences: why it's worth applying, in w.v terms),
  "deliverables": string array (main deliverables the funder wants),
  "capabilitiesRequested": string (the consultant profile / skills the funder asks for),
  "eligibility": { "verdict": one of ${JSON.stringify(VALID_ELIGIBILITY)}, "note": string (the key eligibility factor — e.g. "requires an in-country registered entity", "needs a national consultant") },
  "suggestedApproach": string (1-2 sentences: the angle w.v would take),
  "itemsToVerify": string array (things a human must confirm before applying — budget, exact deadline, partner requirements),
  "requiredConditions": string array (hard conditions the funder imposes; empty array if none found),
  "requiredMaterials": string array (documents/credentials the submission requires; empty array if none found),
  "torIsReal": boolean (true only if the text is a full TOR, not just an announcement/website),
  "torConcern": string or null (if torIsReal is false, one sentence on what was fetched instead; else null)
}`;

    const userMessage = `Opportunity: ${input.opportunityName}
Source: ${input.source ?? "unknown"}
URL: ${input.torUrl ?? "not provided"}
Geography: ${(input.geography ?? []).join(", ") || "unknown"}
Service match (triage): ${(input.serviceMatch ?? []).join(", ") || "unknown"}
Triage rationale: ${input.decisionNotes ?? "none"}

Triage snapshot:
${snapshot || "(none)"}

TOR / announcement text:
${torText || "(none — only the triage snapshot is available)"}`;

    const result = await callClaude({
      feature: "rfp-one-pager",
      system: systemPrompt,
      userMessage,
      userId: "automation",
      // 2000 (not 1200): a content-rich TOR with many deliverables/conditions can
      // otherwise truncate the JSON mid-response → parse failure → null brief.
      maxTokens: 2000,
      temperature: 0.2,
    });

    const parsed = parseJsonResponse<OnePager>(result.text);

    // Normalise: guarantee arrays + a valid eligibility verdict so the UI and
    // downstream never hit undefined.
    const onePager: OnePager = {
      summary: parsed.summary ?? "",
      whyApply: parsed.whyApply ?? "",
      deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
      capabilitiesRequested: parsed.capabilitiesRequested ?? "",
      eligibility: {
        verdict: VALID_ELIGIBILITY.includes(parsed.eligibility?.verdict as (typeof VALID_ELIGIBILITY)[number])
          ? parsed.eligibility.verdict
          : "uncertain",
        note: parsed.eligibility?.note ?? "",
      },
      suggestedApproach: parsed.suggestedApproach ?? "",
      itemsToVerify: Array.isArray(parsed.itemsToVerify) ? parsed.itemsToVerify : [],
      requiredConditions: Array.isArray(parsed.requiredConditions) ? parsed.requiredConditions : [],
      requiredMaterials: Array.isArray(parsed.requiredMaterials) ? parsed.requiredMaterials : [],
      torIsReal: parsed.torIsReal === true,
      torConcern: typeof parsed.torConcern === "string" && parsed.torConcern.trim()
        ? parsed.torConcern.trim()
        : null,
      // Provenance is authoritative from the caller, never the model's guess.
      sourceBasis: input.sourceBasis,
    };

    return {
      onePager,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    };
  } catch (err) {
    console.warn(`${logPrefix} generation failed for ${input.opportunityName}:`, err);
    return null;
  }
}

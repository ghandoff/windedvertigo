/**
 * cARL's citation gate — review a draft queued to publish for claim-boundary
 * and citation problems, against cARL's own findings evidence base.
 *
 * Charter: cARL owns "the citation gate (hard veto)" and "standing
 * falsification duty" — a draft cites research → verification verdict, a
 * strategic claim contradicts evidence → correction. This is the read/judge
 * half; the cron surfaces the verdict through the spine.
 *
 * Haiku (`citation-matching` feature) — fast relevance/verification pass.
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";

export interface CitationVerdict {
  /** "ok" = no research-claim problems; "concerns" = at least one flag. */
  verdict: "ok" | "concerns";
  /** One-line overall read. */
  summary: string;
  /** Specific claim-boundary / citation issues (empty when ok). */
  flags: string[];
  /** Finding titles from the evidence base that support or better-hedge a claim. */
  suggestedSources: string[];
}

const SYSTEM =
  "You are cARL, winded.vertigo's research-integrity check. Review a draft that's queued to " +
  "publish for claim-boundary and citation problems: empirical or research claims stated as fact " +
  "without support, overreach beyond what evidence shows, or claims that contradict the evidence " +
  "base below. The evidence base (a sample of cARL's findings) is provided; where a claim is " +
  "supported — or where a better-hedged version exists — name the relevant finding title. Be " +
  "specific and terse. Do NOT invent citations or sources. If the draft makes no research/empirical " +
  "claims, or all such claims are appropriately supported and hedged, the verdict is \"ok\" with an " +
  'empty flags list. Respond with strict JSON only: {"verdict":"ok|concerns","summary":"<one ' +
  'sentence>","flags":["<specific issue>", ...],"suggestedSources":["<finding title>", ...]}';

export async function checkDraftCitations(
  draft: { title: string | null; contentText: string },
  findings: { title: string; summary: string }[],
): Promise<CitationVerdict | null> {
  const evidence = findings
    .map((f, i) => `[${i + 1}] ${f.title}: ${f.summary}`)
    .join("\n")
    .slice(0, 8000);
  const userMessage =
    `Draft title: ${draft.title ?? "(untitled)"}\n\n` +
    `Draft:\n${draft.contentText.slice(0, 6000)}\n\n` +
    `Evidence base (cARL findings):\n${evidence}`;
  try {
    const result = await callClaude({
      feature: "citation-matching",
      system: SYSTEM,
      userMessage,
      userId: "ambient:carl",
      maxTokens: 500,
    });
    const parsed = parseJsonResponse<CitationVerdict>(result.text);
    if (!parsed || (parsed.verdict !== "ok" && parsed.verdict !== "concerns")) return null;
    parsed.flags = Array.isArray(parsed.flags) ? parsed.flags : [];
    parsed.suggestedSources = Array.isArray(parsed.suggestedSources) ? parsed.suggestedSources : [];
    return parsed;
  } catch (err) {
    console.warn("[carl/citation-check] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

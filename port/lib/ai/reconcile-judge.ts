/**
 * Fuzzy reconciliation judge.
 *
 * Given candidate (human CV capability ↔ agent-observed concept) label pairs
 * that lexical blocking flagged as plausibly-the-same, Haiku decides whether
 * each pair truly names the same professional capability/theory/method — so
 * "Psychometric Validation" ↔ "psychometric measurement" can bridge but
 * "psychometric validation" ↔ "qualitative validation" stays separate.
 *
 * Model: Haiku (cheap, batched, results cached per pair). See FEATURE_MODELS.
 */

import { callClaude, parseJsonResponse } from "./client";

export interface JudgePair {
  id: string; // stable id for the pair (e.g. "keyA::keyB")
  a: string; // human capability label
  b: string; // agent concept label
}

export interface JudgeVerdict {
  id: string;
  same: boolean;
  confidence: number; // 0..1
}

const SYSTEM = `You decide whether two short labels name the SAME professional capability, theory, method, framework, or concept — the kind of judgement that decides if a CV skill and an AI work-agent's working concept should be unified into one node.

Say SAME only when a domain expert would treat them as the same competency or idea, allowing for wording, abbreviation, British/American spelling, singular/plural, and noun/gerund differences. Examples of SAME: "psychometric validation" ≈ "psychometric measurement"; "theory of change" ≈ "ToC"; "structural equation modelling" ≈ "SEM"; "universal design for learning" ≈ "UDL".

Say NOT SAME when they are merely related, share a buzzword, or are sibling sub-fields. Examples of NOT SAME: "qualitative analysis" vs "quantitative analysis"; "survey design" vs "research design"; "facilitation" vs "co-design"; "assessment design" vs "psychometric validation".

Be conservative — when unsure, NOT SAME. Respond with ONLY:
{"results":[{"id":"<pair id>","same":true,"confidence":0.0}]}`;

/** Returns a map of pair id → verdict. Pairs that error are simply omitted. */
export async function judgePairs(pairs: JudgePair[], userId: string): Promise<Map<string, JudgeVerdict>> {
  const out = new Map<string, JudgeVerdict>();
  if (pairs.length === 0) return out;

  const BATCH = 25;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    const userMessage = JSON.stringify(batch.map((p) => ({ id: p.id, a: p.a, b: p.b })));
    try {
      const result = await callClaude({
        feature: "knowledge-reconcile",
        system: SYSTEM,
        userMessage,
        userId,
        maxTokens: 4096,
        temperature: 0,
      });
      const parsed = parseJsonResponse<{ results: JudgeVerdict[] }>(result.text);
      for (const r of parsed.results ?? []) {
        if (typeof r.id === "string") {
          out.set(r.id, {
            id: r.id,
            same: !!r.same,
            confidence: typeof r.confidence === "number" ? r.confidence : r.same ? 0.7 : 0,
          });
        }
      }
    } catch (err) {
      console.error("[reconcile-judge] batch failed, skipping:", err);
    }
  }
  return out;
}

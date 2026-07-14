/**
 * Group AI token usage by the AGENT that drove it.
 *
 * `getUsageSummary().byFeature` is seeded from a stale feature list (misses
 * pam-action-triage, opsy-*, etc.), so we read raw entries via getUsageEntries
 * and bucket them ourselves with an explicit feature → agent map.
 */

import type { AiFeature } from "./types";
import { getUsageEntries } from "./usage-store";

const FEATURE_AGENT: Partial<Record<AiFeature, string>> = {
  "pam-action-triage": "pam",
  "whirlpool-sweep": "pam",
  "rfp-triage": "biz",
  "proposal-generation": "biz",
  "rfp-document-extraction": "biz",
  "rfp-question-parse": "biz",
  "carl-study": "carl",
  "carl-research": "carl",
  "citation-matching": "carl",
  "bibliography-import": "carl",
  "opsy-email-triage": "opsy",
  "opsy-digest": "opsy",
  "weekly-digest": "mo",
  "conference-triage": "mo",
};

export interface AgentSpend {
  agent: string;
  spendUsd: number;
  calls: number;
}

/** Token spend + call count per agent over [fromIso, toIso]. Keyed by agent slug. */
export async function getAgentSpend(
  fromIso: string,
  toIso: string,
): Promise<Record<string, AgentSpend>> {
  const entries = await getUsageEntries(fromIso, toIso).catch(() => []);
  const out: Record<string, AgentSpend> = {};
  for (const e of entries) {
    const agent = FEATURE_AGENT[e.feature];
    if (!agent) continue;
    if (!out[agent]) out[agent] = { agent, spendUsd: 0, calls: 0 };
    out[agent].spendUsd += e.costUsd;
    out[agent].calls += 1;
  }
  return out;
}

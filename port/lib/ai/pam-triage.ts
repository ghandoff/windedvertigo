/**
 * PaM action-item triage.
 *
 * Given freshly-ingested meeting action items + the current set of open PaM
 * commitments, decide for each action:
 *   - is it meaningful enough to track as a commitment? (drop FYIs / vague chatter)
 *   - which whirlpool cycle (ISO Monday) should it land in?
 *   - what commitment_type best fits (action / learning / connection / ritual)?
 *   - what priority?
 *   - does it duplicate an existing open commitment? (→ merge instead of create)
 *
 * This is the "review-inbox" feed: triage writes a suggestion onto each action;
 * a human accepts / merges / dismisses from the PaM inbox. Triage never writes
 * to pam_commitments directly.
 *
 * Model: Haiku (cheap, runs over a batch per cron). See FEATURE_MODELS.
 */

import { callClaude, parseJsonResponse } from "./client";

export interface TriageInputAction {
  id: string;
  title: string;
  owner: string | null; // owner_email or name, for context
  deadline: string | null;
  type: string | null;
  priority: string | null;
  context: string | null;
}

export interface TriageExistingCommitment {
  id: string;
  who: string;
  what: string;
}

export type CommitmentType = "action" | "learning" | "connection" | "ritual";

export interface TriageSuggestion {
  actionId: string;
  meaningful: boolean;
  suggestedCycle: string | null; // ISO Monday "YYYY-MM-DD", or null = backlog
  suggestedType: CommitmentType;
  priority: "low" | "medium" | "high";
  mergeWith: string | null; // existing commitment id this duplicates, or null
  reason: string; // one short sentence — why meaningful/not, why merge
}

export interface TriageResult {
  suggestions: TriageSuggestion[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

const SYSTEM_PROMPT = `You are PaM, the project + momentum manager for winded.vertigo, a learning-design collective. You triage action items extracted from meeting transcripts before they reach the team's commitment board.

For EACH action item, decide:
- meaningful: true if it is a concrete, trackable piece of work someone owns. false for FYIs, vague aspirations, personal/social chatter, or items already obviously done.
- suggestedCycle: the ISO Monday (YYYY-MM-DD) of the week it should land in. Use the provided currentCycle for near-term work; null for backlog/someday items with no urgency.
- suggestedType: one of action | learning | connection | ritual.
    action = build/do/ship something. learning = research, review, read, explore. connection = reach out to / coordinate with a person or org. ritual = a recurring habit or standing practice.
- priority: low | medium | high (carry over the action's own priority unless the context clearly argues otherwise).
- mergeWith: if this action clearly duplicates one of the existing open commitments provided, return that commitment's id. Otherwise null. Only merge on genuine overlap (same work, same intent) — not loose topical similarity.
- reason: one short sentence.

Output ONLY valid JSON, no prose:
{ "suggestions": [ { "actionId": "...", "meaningful": true, "suggestedCycle": "2026-06-22", "suggestedType": "action", "priority": "medium", "mergeWith": null, "reason": "..." } ] }

Return exactly one suggestion object per input action, preserving actionId.`;

export async function triageActions(
  actions: TriageInputAction[],
  existing: TriageExistingCommitment[],
  currentCycle: string,
  userId: string,
): Promise<TriageResult> {
  if (actions.length === 0) {
    return { suggestions: [], usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  }

  const userMessage = [
    `currentCycle (ISO Monday of this week): ${currentCycle}`,
    "",
    "Existing open commitments (for dedup — mergeWith one of these ids only on genuine overlap):",
    JSON.stringify(existing, null, 2),
    "",
    "Action items to triage:",
    JSON.stringify(actions, null, 2),
  ].join("\n");

  const result = await callClaude({
    feature: "pam-action-triage",
    system: SYSTEM_PROMPT,
    userMessage,
    userId,
    // ~80 tokens per suggestion; callers batch (see cron) to stay well under
    // this, but keep generous headroom so a single batch never truncates.
    maxTokens: 8192,
    temperature: 0.2,
  });

  const parsed = parseJsonResponse<{ suggestions: TriageSuggestion[] }>(result.text);

  // Defensive: only keep suggestions whose actionId is in the input set, and
  // backfill any actions the model dropped as "not meaningful" so every action
  // gets a deterministic triage outcome.
  const byId = new Map(parsed.suggestions.map((s) => [s.actionId, s]));
  const suggestions: TriageSuggestion[] = actions.map((a) => {
    const s = byId.get(a.id);
    if (s) return s;
    return {
      actionId: a.id,
      meaningful: false,
      suggestedCycle: null,
      suggestedType: "action",
      priority: (a.priority as TriageSuggestion["priority"]) ?? "medium",
      mergeWith: null,
      reason: "not returned by triage; defaulted to dismissed",
    };
  });

  return {
    suggestions,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}

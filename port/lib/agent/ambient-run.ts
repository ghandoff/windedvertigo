/**
 * The ambient-agent judgment pass — NOT runAgentTurn (index.ts). That's the
 * DM/mention conversational loop: thread memory, confirm-gated pending
 * writes, one Slack message in → one reply out. This is a different shape:
 * a batch of Slack messages in → a single structured decision out
 * (docs/prompts/executive-agents-phase1-build.md §2.2), invoked by the
 * agent-ambient-sweep cron, never by the events route directly.
 *
 * Two-pass cost guard (spec §3): a cheap Haiku pre-filter decides whether a
 * batch is even worth a full judgment call; only relevant batches reach the
 * Sonnet pass. Phase-1 simplification: the "artifact" is drafted directly by
 * the judgment call's own structured output (a title/body pair), not built
 * via a separate tool-use loop — matches how every other cron in this repo
 * (weekly-digest, collective-digest, etc.) produces text with one callClaude
 * call. A richer tool-driven artifact-builder is future work if phase-1
 * drafts prove too shallow.
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { CHARTERS, SHARED_CHARTER_RULES } from "./charters.generated";
import { fetchAgentBriefing } from "./agent-prompts";
import {
  insertIntervention,
  setInterventionStatus,
  getRecentInterventionCount,
  getRecentInterventionCountForHuman,
  type InterventionDecision,
  type RiskTier,
} from "@/lib/supabase/agent-interventions";
import { postToChannelResilientDetailed, sendDmByEmail } from "@/lib/slack";
import { buildInterventionBlocks, interventionFallbackText } from "./intervention-card";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "./ambient-rollout";
import type { EventLogRow } from "@/lib/supabase/event-log";

export type AmbientAgentId = "mo" | "pam";

const AGENT_DAILY_CAP = 3;
const HUMAN_DAILY_CAP = 5;
const HIGH_TIER_DEFAULT_EXPIRY_HOURS = 24;

interface AmbientDecisionOutput {
  decision: InterventionDecision;
  trigger: string;
  artifact?: { title?: string; body?: string; executeAction?: Record<string, unknown> } | null;
  riskTier: RiskTier;
  rationale: string;
  targetHuman?: string | null;
  expiresInHours?: number | null;
}

function formatBatchForPrompt(batch: EventLogRow[]): string {
  return batch
    .map((e) => {
      const p = e.payload as { user?: string; text?: string };
      return `[${e.ts}] channel=${e.channel} user=${p.user ?? "?"}: ${p.text ?? ""}`;
    })
    .join("\n");
}

/** Cheap relevance check. Fails closed — a Haiku error skips the batch this tick rather than risking a needless Sonnet call. */
async function runPrefilter(agentId: AmbientAgentId, batch: EventLogRow[]): Promise<boolean> {
  const system =
    `You are a cheap relevance pre-filter for ${agentId}'s ambient watch — deciding only ` +
    `whether a batch of Slack messages is worth a full judgment pass, not what to do about it. ` +
    `Err toward "no": most channel chatter is not charter-relevant. ` +
    `Respond with strict JSON only: {"relevant": boolean}.`;
  const userMessage = `Charter:\n${CHARTERS[agentId]}\n\nMessages:\n${formatBatchForPrompt(batch)}`;
  try {
    const result = await callClaude({
      feature: "ambient-prefilter",
      system,
      userMessage,
      userId: `ambient:${agentId}`,
      maxTokens: 100,
    });
    return !!parseJsonResponse<{ relevant: boolean }>(result.text).relevant;
  } catch (err) {
    console.warn(`[ambient-run] prefilter failed for ${agentId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function runJudgment(
  agentId: AmbientAgentId,
  batch: EventLogRow[],
): Promise<{ output: AmbientDecisionOutput; costUsd: number } | null> {
  const briefing = await fetchAgentBriefing(agentId);
  const system =
    `${SHARED_CHARTER_RULES}\n\n${CHARTERS[agentId]}\n\n## current state\n${briefing}\n\n` +
    `You are watching Slack for proactive intervention opportunities per your charter above. ` +
    `Given the batch of messages below, decide one of: ` +
    `silent (nothing worth surfacing — the common, correct default), ` +
    `act_low (do it quietly, no gate), act_notify (do it and tell someone, reversible), ` +
    `or preview (needs explicit human approval before anything happens — anything public, ` +
    `client-facing, financial, or irreversible per the shared risk-tier rules above).\n\n` +
    `Respond with strict JSON only:\n` +
    `{"decision":"silent|act_low|act_notify|preview","trigger":"one sentence naming what happened",` +
    `"artifact":{"title":"...","body":"..."} or null,"riskTier":"low|medium|high",` +
    `"rationale":"why this tier/decision","targetHuman":"email or null","expiresInHours": number or null}`;
  try {
    const result = await callClaude({
      feature: "ambient-agent-run",
      system,
      userMessage: formatBatchForPrompt(batch),
      userId: `ambient:${agentId}`,
      maxTokens: 1024,
    });
    return { output: parseJsonResponse<AmbientDecisionOutput>(result.text), costUsd: result.costUsd };
  } catch (err) {
    console.warn(`[ambient-run] judgment failed for ${agentId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Run one ambient judgment pass for a debounced batch of events, insert the
 * resulting agent_interventions row, and (budget permitting) post/apply it.
 * Called by the agent-ambient-sweep cron once per (agent, channel) batch
 * that clears the quiet-window/high-signal debounce.
 */
export async function runAmbientAgentPass(
  agentId: AmbientAgentId,
  batch: EventLogRow[],
): Promise<void> {
  if (batch.length === 0) return;

  const relevant = await runPrefilter(agentId, batch);
  if (!relevant) return; // not even worth logging a silent row — this is the cost guard, not a real judgment call

  const judged = await runJudgment(agentId, batch);
  if (!judged) return;
  const { output, costUsd } = judged;

  const channel = batch[0]?.channel ?? null;
  const { decision, riskTier } = output;

  // Budget check BEFORE surfacing (spec §2.2) — silent decisions are never
  // gated or counted against the ≤3/agent/day, ≤5/human/day caps.
  let suppressedByBudget = false;
  if (decision !== "silent") {
    const agentCount = await getRecentInterventionCount(agentId);
    const humanCount = output.targetHuman
      ? await getRecentInterventionCountForHuman(output.targetHuman)
      : 0;
    suppressedByBudget =
      agentCount >= AGENT_DAILY_CAP || (!!output.targetHuman && humanCount >= HUMAN_DAILY_CAP);
  }

  const expiresAt =
    riskTier === "high"
      ? new Date(
          Date.now() + (output.expiresInHours ?? HIGH_TIER_DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000,
        ).toISOString()
      : null;

  const row = await insertIntervention({
    agent: agentId,
    decision,
    riskTier,
    trigger: output.trigger,
    artifact: output.artifact ?? null,
    rationale: output.rationale,
    channel,
    expiresAt,
    targetHuman: output.targetHuman ?? null,
    costUsd,
    modelId: "claude-sonnet-4-6",
  });
  if (!row) return;

  // Silent, or over budget — logged for audit/metrics, nothing posted. Over-
  // budget rows stay `proposed` in the inbox as low-priority (spec §2.2).
  if (decision === "silent" || suppressedByBudget) return;

  const text = interventionFallbackText(row);
  // Sandbox-stage safety: a per-person DM has no channel to redirect through
  // the way ambientNotifyChannel() redirects channel posts, so during
  // "sandbox" stage any targetHuman DM is rerouted to the sandbox channel
  // instead of paging a real teammate (see ambientDirectDmsAllowed()).
  const dmsAllowed = ambientDirectDmsAllowed();

  if (decision === "preview") {
    const blocks = buildInterventionBlocks(row);
    if (output.targetHuman && dmsAllowed) {
      await sendDmByEmail(output.targetHuman, text, blocks);
    } else if (output.targetHuman) {
      await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${output.targetHuman}]\n${text}`, [], blocks);
    } else if (channel) {
      await postToChannelResilientDetailed(channel, text, [], blocks);
    }
    return; // stays `proposed` — human resolves via the interactive buttons
  }

  // act_low / act_notify — auto-apply, tier decides whether/how loudly to notify.
  if (output.targetHuman && dmsAllowed) {
    await sendDmByEmail(output.targetHuman, text);
  } else if (output.targetHuman) {
    await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${output.targetHuman}] ${text}`);
  } else if (channel && decision === "act_notify") {
    await postToChannelResilientDetailed(channel, text);
  }
  // act_low with neither a target human nor a notify-worthy channel post is
  // correct as a silent-apply — LOW tier is "act, no gate", not "notify".
  await setInterventionStatus(row.id, "executed");
}

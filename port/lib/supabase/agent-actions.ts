/**
 * Supabase read/write layer for wv-claw agent audit (W0.1).
 *
 * Replaces the Notion `agent actions` DB as the source of truth for agent
 * turn history. lib/agent/audit.ts dual-writes (Notion + here) until the
 * Notion path is retired after a ~1-week trial.
 *
 * Idempotency: hasAgentActionForEvent(eventId) is the primary check used
 * by runAgentTurn at the start of each turn to dedupe Slack at-least-once
 * deliveries. Falls open (returns false) on Supabase errors so a transient
 * Supabase issue doesn't drop legitimate events.
 */

import { supabase } from "./client";

export type AgentActionStatus = "success" | "error" | "timeout" | "rejected";

export interface AgentActionEntry {
  eventId: string;
  userEmail: string;
  displayName: string;
  status: AgentActionStatus;
  toolsCalled: string[];
  turnCount: number | null;
  durationMs: number | null;
  replyPreview: string | null;
  errorMessage: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  modelId: string | null;
  // Cache effectiveness (W0.3 follow-up). Optional — older callers and
  // rejection paths leave these null.
  cacheCreationInputTokens?: number | null;
  cacheReadInputTokens?: number | null;
}

/** Insert a new audit row. Fails open — logs and returns on error. */
export async function insertAgentAction(entry: AgentActionEntry): Promise<void> {
  try {
    const { error } = await supabase.from("agent_actions").insert({
      event_id:      entry.eventId,
      user_email:    entry.userEmail,
      display_name:  entry.displayName,
      status:        entry.status,
      tools_called:  entry.toolsCalled,
      turn_count:    entry.turnCount,
      duration_ms:   entry.durationMs,
      reply_preview: entry.replyPreview,
      error_message: entry.errorMessage,
      input_tokens:  entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_usd:      entry.costUsd,
      model_id:      entry.modelId,
      cache_creation_input_tokens: entry.cacheCreationInputTokens ?? null,
      cache_read_input_tokens:     entry.cacheReadInputTokens ?? null,
    });
    if (error) {
      console.warn("[supabase/agent-actions] insert failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[supabase/agent-actions] insert threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Sum cost_usd for a user across a recent window. Used by the per-user
 * daily budget guard in runAgentTurn. Fails open (returns 0) on error:
 * the cost guard should never block legitimate users due to a transient
 * Supabase issue.
 */
export async function getRecentSpendByUser(
  userEmail: string,
  hours = 24,
): Promise<number> {
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from("agent_actions")
      .select("cost_usd")
      .eq("user_email", userEmail.toLowerCase())
      .gte("created_at", sinceIso);
    if (error) {
      console.warn("[supabase/agent-actions] spend lookup failed:", error.message);
      return 0;
    }
    return (data ?? []).reduce(
      (sum, r) => sum + (typeof r.cost_usd === "number" ? r.cost_usd : 0),
      0,
    );
  } catch (err) {
    console.warn(
      "[supabase/agent-actions] spend lookup threw:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}

/**
 * Idempotency check — returns true if a row already exists for this event_id.
 * Falls open (returns false) on any error: a double-run is recoverable; a
 * missed-run leaves the user with no reply, which is worse.
 */
export async function hasAgentActionForEvent(eventId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("agent_actions")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);
    if (error) {
      console.warn(
        "[supabase/agent-actions] idempotency check failed:",
        error.message,
      );
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn(
      "[supabase/agent-actions] idempotency check threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

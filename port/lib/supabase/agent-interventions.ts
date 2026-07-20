/**
 * Supabase read/write layer for the ambient-agent spine's decision queue —
 * NOT wv-claw's per-turn audit log (see ./agent-actions.ts, a separate table
 * with a different purpose: per-Slack-turn cost/audit vs. this table's
 * proactive-intervention/preview-card review flow).
 *
 * Backs: the /inbox InterventionCard, the notification-budget guards in
 * lib/agent/ambient-run.ts, the agent-interventions-expire cron's
 * default-deny sweep, and Opsy's future graduation-analysis queries.
 *
 * Same fail-open, snake_case-mapping style as ./agent-actions.ts.
 */

import { supabase } from "./client";

export type InterventionAgent = "opsy" | "biz" | "pam" | "mo" | "carl" | "fin";
export type InterventionDecision = "silent" | "act_low" | "act_notify" | "preview";
export type RiskTier = "low" | "medium" | "high";
export type InterventionStatus =
  | "proposed"
  | "approved"
  | "edited"
  | "redirected"
  | "ignored"
  | "expired"
  | "executed";

export interface InterventionEntry {
  agent: InterventionAgent;
  triggerEventId?: string | null;
  decision: InterventionDecision;
  riskTier: RiskTier;
  trigger: string;
  artifact?: Record<string, unknown> | null;
  rationale?: string | null;
  channel?: string | null;
  expiresAt?: string | null; // ISO — set for riskTier "high"
  targetHuman?: string | null;
  costUsd?: number | null;
  modelId?: string | null;
}

export interface InterventionRow {
  id: string;
  agent: InterventionAgent;
  triggerEventId: string | null;
  decision: InterventionDecision;
  riskTier: RiskTier;
  trigger: string;
  artifact: Record<string, unknown> | null;
  rationale: string | null;
  channel: string | null;
  previewMessageTs: string | null;
  status: InterventionStatus;
  expiresAt: string | null;
  targetHuman: string | null;
  human: string | null;
  resolvedAt: string | null;
  outcomeNotes: string | null;
  costUsd: number | null;
  modelId: string | null;
  createdAt: string;
}

function fromRow(row: Record<string, unknown>): InterventionRow {
  return {
    id: row.id as string,
    agent: row.agent as InterventionAgent,
    triggerEventId: (row.trigger_event_id as string | null) ?? null,
    decision: row.decision as InterventionDecision,
    riskTier: row.risk_tier as RiskTier,
    trigger: row.trigger as string,
    artifact: (row.artifact as Record<string, unknown> | null) ?? null,
    rationale: (row.rationale as string | null) ?? null,
    channel: (row.channel as string | null) ?? null,
    previewMessageTs: (row.preview_message_ts as string | null) ?? null,
    status: row.status as InterventionStatus,
    expiresAt: (row.expires_at as string | null) ?? null,
    targetHuman: (row.target_human as string | null) ?? null,
    human: (row.human as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    outcomeNotes: (row.outcome_notes as string | null) ?? null,
    costUsd: (row.cost_usd as number | null) ?? null,
    modelId: (row.model_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Insert a new intervention row. Fails open — logs and returns null on error. */
export async function insertIntervention(
  entry: InterventionEntry,
): Promise<InterventionRow | null> {
  try {
    const { data, error } = await supabase
      .from("agent_interventions")
      .insert({
        agent:            entry.agent,
        trigger_event_id: entry.triggerEventId ?? null,
        decision:         entry.decision,
        risk_tier:        entry.riskTier,
        trigger:          entry.trigger,
        artifact:         entry.artifact ?? null,
        rationale:        entry.rationale ?? null,
        channel:          entry.channel ?? null,
        expires_at:       entry.expiresAt ?? null,
        target_human:     entry.targetHuman ?? null,
        cost_usd:         entry.costUsd ?? null,
        model_id:         entry.modelId ?? null,
      })
      .select()
      .single();
    if (error) {
      console.warn("[supabase/agent-interventions] insert failed:", error.message);
      return null;
    }
    return fromRow(data);
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] insert threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Record the Slack card's message ts once posted (for audit / future response_url-less updates). */
export async function setPreviewMessageTs(id: string, ts: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_interventions")
      .update({ preview_message_ts: ts })
      .eq("id", id);
    if (error) {
      console.warn("[supabase/agent-interventions] setPreviewMessageTs failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] setPreviewMessageTs threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function listInterventions(
  status: InterventionStatus = "proposed",
): Promise<InterventionRow[]> {
  try {
    const { data, error } = await supabase
      .from("agent_interventions")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[supabase/agent-interventions] list failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] list threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Recent rows for one agent, any status — used by crons that need to check
 * "have I already raised this?" against artifact contents client-side
 * (e.g. pam-owner-confirmation-sweep matching artifact.executeAction.
 * meetingActionItemId) without a fragile JSONB path filter.
 */
export async function listRecentByAgent(
  agent: InterventionAgent,
  days = 7,
): Promise<InterventionRow[]> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from("agent_interventions")
      .select("*")
      .eq("agent", agent)
      .gte("created_at", sinceIso);
    if (error) {
      console.warn("[supabase/agent-interventions] listRecentByAgent failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] listRecentByAgent threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function getIntervention(id: string): Promise<InterventionRow | null> {
  try {
    const { data, error } = await supabase
      .from("agent_interventions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[supabase/agent-interventions] get failed:", error.message);
      return null;
    }
    return fromRow(data);
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] get threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Resolve a proposed intervention with a human decision. Returns false
 * (no-op) if the row is already resolved — callers should treat that as
 * "someone else already clicked", not an error.
 */
export async function resolveIntervention(
  id: string,
  status: Exclude<InterventionStatus, "proposed">,
  human: string,
  outcomeNotes?: string,
): Promise<boolean> {
  try {
    const existing = await getIntervention(id);
    if (!existing) return false;
    if (existing.status !== "proposed") return false;

    const { error } = await supabase
      .from("agent_interventions")
      .update({
        status,
        human,
        resolved_at: new Date().toISOString(),
        outcome_notes: outcomeNotes ?? null,
      })
      .eq("id", id)
      .eq("status", "proposed"); // race guard — only the first click wins
    if (error) {
      console.warn("[supabase/agent-interventions] resolve failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] resolve threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Direct status transition with no "must currently be proposed" guard —
 * used after resolveIntervention() has already moved a row out of
 * `proposed` (e.g. approved → executed once the follow-up write succeeds).
 */
export async function setInterventionStatus(
  id: string,
  status: InterventionStatus,
  outcomeNotes?: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("agent_interventions")
      .update({
        status,
        ...(outcomeNotes !== undefined ? { outcome_notes: outcomeNotes } : {}),
      })
      .eq("id", id);
    if (error) {
      console.warn("[supabase/agent-interventions] setInterventionStatus failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] setInterventionStatus threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Default-deny sweep for the agent-interventions-expire cron: flips any
 * high-tier row still `proposed` past its expires_at to `expired`. Returns
 * the count flipped.
 */
export async function expireOverdueInterventions(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("agent_interventions")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("status", "proposed")
      .lt("expires_at", new Date().toISOString())
      .select("id");
    if (error) {
      console.warn("[supabase/agent-interventions] expire sweep failed:", error.message);
      return 0;
    }
    return data?.length ?? 0;
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] expire sweep threw:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}

/**
 * Count non-silent interventions raised by an agent in the trailing window —
 * the ≤3/agent/day budget guard. Checked BEFORE surfacing (spec §2.2): if
 * over budget, the caller should still insert the row (so nothing is lost)
 * but skip the Slack post, leaving it queued in the inbox as low-priority.
 * Fails open (returns 0) so a transient Supabase issue never silently
 * blocks a legitimate intervention.
 */
export async function getRecentInterventionCount(
  agent: InterventionAgent,
  hours = 24,
): Promise<number> {
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  try {
    const { count, error } = await supabase
      .from("agent_interventions")
      .select("id", { count: "exact", head: true })
      .eq("agent", agent)
      .neq("decision", "silent")
      .gte("created_at", sinceIso);
    if (error) {
      console.warn("[supabase/agent-interventions] agent count failed:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] agent count threw:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}

/** Same as above, but the ≤5/human/day budget — counts by target_human, not agent. */
export async function getRecentInterventionCountForHuman(
  email: string,
  hours = 24,
): Promise<number> {
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  try {
    const { count, error } = await supabase
      .from("agent_interventions")
      .select("id", { count: "exact", head: true })
      .eq("target_human", email.toLowerCase())
      .neq("decision", "silent")
      .gte("created_at", sinceIso);
    if (error) {
      console.warn("[supabase/agent-interventions] human count failed:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] human count threw:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}

export interface InterventionMetrics {
  agent: InterventionAgent;
  total: number;
  actedUponRate: number;   // approved + edited + redirected / total non-ignored,non-expired resolved
  dismissedRate: number;   // ignored / resolved
  falseEscalationRate: number; // redirected / resolved — treated as a proxy: the agent picked the wrong human/tier
}

/**
 * Per-agent metrics for Opsy's future graduation analysis (acceptance
 * criterion 6 — "no dashboard needed yet", so this is a plain query, not a UI).
 */
export async function getInterventionMetrics(
  days = 30,
): Promise<InterventionMetrics[]> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from("agent_interventions")
      .select("agent, status")
      .neq("decision", "silent")
      .gte("created_at", sinceIso);
    if (error) {
      console.warn("[supabase/agent-interventions] metrics query failed:", error.message);
      return [];
    }
    const byAgent = new Map<InterventionAgent, { total: number; statuses: Record<string, number> }>();
    for (const row of data ?? []) {
      const agent = row.agent as InterventionAgent;
      const entry = byAgent.get(agent) ?? { total: 0, statuses: {} };
      entry.total += 1;
      entry.statuses[row.status] = (entry.statuses[row.status] ?? 0) + 1;
      byAgent.set(agent, entry);
    }
    return [...byAgent.entries()].map(([agent, { total, statuses }]) => {
      const resolved =
        (statuses.approved ?? 0) +
        (statuses.edited ?? 0) +
        (statuses.redirected ?? 0) +
        (statuses.ignored ?? 0) +
        (statuses.expired ?? 0) +
        (statuses.executed ?? 0);
      const actedUpon = (statuses.approved ?? 0) + (statuses.edited ?? 0) + (statuses.executed ?? 0);
      return {
        agent,
        total,
        actedUponRate: resolved > 0 ? actedUpon / resolved : 0,
        dismissedRate: resolved > 0 ? (statuses.ignored ?? 0) / resolved : 0,
        falseEscalationRate: resolved > 0 ? (statuses.redirected ?? 0) / resolved : 0,
      };
    });
  } catch (err) {
    console.warn(
      "[supabase/agent-interventions] metrics query threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

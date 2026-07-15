/**
 * Shared escalation ladder for all six agents (opsy, biz, pam, mo, carl, fin) —
 * docs/human-agent-collaboration-review-2026-07-14.md §7, "the operating
 * rhythm": light touch by default, interrupts reserved for genuine gates.
 *
 *   1. FYI            → no-op. Dashboards already read from each agent's own
 *                        tables (biz_decisions, pam commitments, opsy
 *                        incidents, …) — no new "dashboard" concept needed.
 *   2. digest marker   → a row in agent_escalations, no Slack post. The next
 *                        digest cron (e.g. collective-digest) queries
 *                        getOpenLevel2Escalations() and folds it into a
 *                        "decisions needed" line — same idea as Opsy's Sunday
 *                        digest being told to add that as its first line.
 *   3. channel post     → postToChannelResilient (lib/slack.ts), threaded
 *                        resolve-note reply via resolveEscalation() — Opsy's
 *                        `:large_green_circle: *resolved* — …` pattern
 *                        (lib/opsy/alerts.ts), generalized to every agent.
 *   4. DM to shepherd   → resolveShepherd() + sendDmByEmail.
 *   5. DM + phone-worthy → same as 4, with an explicit urgency marker.
 *
 * Every function here is fail-open: escalating must never break a cron run.
 * Errors are swallowed and warned, matching lib/opsy/alerts.ts / lib/slack.ts.
 *
 * ── known simplifications (see PR description for the full rationale) ──────
 *
 * - **No RACI/shepherd table exists in this codebase.** resolveShepherd() is
 *   shaped as a lookup so a real per-project/per-agent routing table can be
 *   dropped in later without touching any call site, but today it always
 *   falls back to the single ops-lead owner (OPS_LEAD_EMAIL, matching
 *   lib/opsy/alerts.ts's constant of the same name).
 * - **No telephony integration exists.** Level 5 ("phone-worthy") cannot
 *   literally call a phone — it sends a DM with a 🚨 prefix and the literal
 *   words "needs a response today", the closest honest equivalent with what
 *   this codebase has.
 */

import { supabase } from "@/lib/supabase/client";
import { postToChannelResilientDetailed, postThreadReply, sendDmByEmail } from "@/lib/slack";

export type EscalationAgent = "opsy" | "biz" | "pam" | "mo" | "carl" | "fin";
export type EscalationLevel = 1 | 2 | 3 | 4 | 5;
export type EscalationStatus = "open" | "resolved";

// Matches lib/opsy/alerts.ts's OPS_LEAD_EMAIL — the single fallback owner
// until a real RACI/shepherd lookup exists (see module doc above).
const OPS_LEAD_EMAIL = "garrett@windedvertigo.com";

export interface EscalateInput {
  agent: EscalationAgent;
  level: EscalationLevel;
  message: string;
  /** required for level 3+ (the topic channel to post/thread in) */
  channel?: string;
  /** free-form context for future shepherd/RACI routing — persisted as-is */
  context?: Record<string, unknown>;
}

export interface EscalateResult {
  posted: boolean;
  escalationId?: string;
}

export interface EscalationRow {
  id: string;
  agent: EscalationAgent;
  level: EscalationLevel;
  message: string;
  channel: string | null;
  status: EscalationStatus;
  context: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Resolve the human who should be DM'd for a level-4/5 escalation.
 *
 * There is no RACI/shepherd-per-project mapping anywhere in this codebase
 * yet (docs/human-agent-collaboration-review-2026-07-14.md §7 says "route by
 * RACI" but no such table exists — building the full RACI system is a
 * separate, much bigger initiative). This always returns the single
 * fallback owner. It's deliberately shaped to take a `context` bag so a real
 * lookup (project → shepherd, agent → default shepherd, etc.) can replace
 * the body later without changing any `escalate()` call site.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function resolveShepherd(context?: Record<string, unknown>): string {
  return OPS_LEAD_EMAIL;
}

async function insertEscalation(row: {
  agent: EscalationAgent;
  level: EscalationLevel;
  message: string;
  channel?: string;
  slack_ts?: string;
  context?: Record<string, unknown>;
}): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("agent_escalations")
    .insert({
      agent: row.agent,
      level: row.level,
      message: row.message,
      channel: row.channel ?? null,
      slack_ts: row.slack_ts ?? null,
      context: row.context ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[escalation] failed to log escalation row:", error.message);
    return undefined;
  }
  return data?.id as string | undefined;
}

/**
 * Route an agent notification through the escalation ladder. Never throws —
 * alerting must never break a cron run (same fail-open contract as
 * lib/opsy/alerts.ts's postOps() and lib/slack.ts's postToChannelResilient()).
 */
export async function escalate(input: EscalateInput): Promise<EscalateResult> {
  const { agent, level, message, channel, context } = input;

  try {
    if (level === 1) {
      // FYI → dashboard only, nothing to log or post.
      return { posted: false };
    }

    if (level === 2) {
      // Digest marker only — never posts to Slack. See getOpenLevel2Escalations().
      const escalationId = await insertEscalation({ agent, level, message, context });
      return { posted: false, escalationId };
    }

    if (!channel) {
      console.warn(`[escalation] level ${level} escalation from ${agent} is missing a channel — dropping: ${message}`);
      return { posted: false };
    }

    if (level === 3) {
      const { posted, ts, resolvedChannel } = await postToChannelResilientDetailed(channel, message, [OPS_LEAD_EMAIL]);
      const escalationId = await insertEscalation({
        agent,
        level,
        message,
        channel: resolvedChannel ?? channel,
        slack_ts: posted ? ts : undefined,
        context,
      });
      return { posted, escalationId };
    }

    // level 4/5 — DM the shepherd. Level 5 adds the urgency marker (the
    // closest honest equivalent to "phone-worthy" without telephony).
    const shepherd = resolveShepherd(context);
    const text = level === 5 ? `🚨 ${message}\n\nneeds a response today.` : message;
    const posted = await sendDmByEmail(shepherd, text);
    const escalationId = await insertEscalation({ agent, level, message: text, channel, context });
    return { posted, escalationId };
  } catch (err) {
    console.warn("[escalation] escalate() failed:", err);
    return { posted: false };
  }
}

/**
 * Close a level-3 escalation with a threaded resolve-note reply, styled
 * exactly like Opsy's existing pattern (lib/opsy/alerts.ts's
 * notifyIncidentResolved): `:large_green_circle: *resolved* — …`, lowercase,
 * one or two lines. Idempotent — resolving an already-resolved escalation is
 * a no-op that returns true. Fail-open: never throws.
 */
export async function resolveEscalation(escalationId: string, resolutionNote: string): Promise<boolean> {
  try {
    const { data: row, error } = await supabase
      .from("agent_escalations")
      .select("agent, channel, slack_ts, status")
      .eq("id", escalationId)
      .single();

    if (error || !row) {
      console.warn(`[escalation] resolveEscalation: could not load ${escalationId}:`, error?.message);
      return false;
    }
    if (row.status === "resolved") return true;

    let posted = false;
    if (row.channel && row.slack_ts) {
      posted = await postThreadReply(
        row.channel,
        row.slack_ts,
        `:large_green_circle: *resolved* — ${row.agent}\n${resolutionNote}`,
      );
    }

    const { error: updateErr } = await supabase
      .from("agent_escalations")
      .update({ status: "resolved", resolution_note: resolutionNote, resolved_at: new Date().toISOString() })
      .eq("id", escalationId);
    if (updateErr) {
      console.warn(`[escalation] resolveEscalation: failed to update row ${escalationId}:`, updateErr.message);
    }

    return posted;
  } catch (err) {
    console.warn("[escalation] resolveEscalation() failed:", err);
    return false;
  }
}

/**
 * Level-2 escalations opened since `sinceIso` (default: 24h ago), across all
 * agents — the "decisions needed" feed for digest crons (see
 * app/api/cron/collective-digest). Read-only, never throws (returns []).
 */
export async function getOpenLevel2Escalations(sinceIso?: string): Promise<EscalationRow[]> {
  try {
    const since = sinceIso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("agent_escalations")
      .select("id, agent, level, message, channel, status, context, created_at")
      .eq("level", 2)
      .eq("status", "open")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[escalation] getOpenLevel2Escalations failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[escalation] getOpenLevel2Escalations failed:", err);
    return [];
  }
}

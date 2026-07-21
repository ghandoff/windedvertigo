/**
 * Shared notification-budget guard for the ambient-agent spine.
 *
 * The charter caps proactive interventions at ≤3 per agent per day and ≤5 per
 * human per day (docs/agents/executive-charters.md, "Shared rules"). Spec §2.2
 * semantics: the check happens BEFORE surfacing — if over budget, the caller
 * still INSERTS the agent_interventions row (nothing is lost; it queues in
 * /inbox as low-priority) and skips ONLY the Slack post/DM.
 *
 * "Budget consumed" is measured in inserted non-silent rows in the trailing
 * 24h (getRecentInterventionCount / …ForHuman) — NOT posts — so an over-budget
 * row that was inserted-but-not-posted still counts, exactly as the DB count
 * sees it on the next run. Both helpers fail open (a transient Supabase error
 * reads as 0), so a DB blip never silently blocks a legitimate intervention.
 *
 * Two entry points:
 *   - isOverNotificationBudget()  — one-shot check for single-intervention
 *     callers (lib/agent/ambient-run.ts).
 *   - NotificationBudget          — a stateful tracker for crons that surface
 *     MANY interventions in one run (pam-owner-confirmation-sweep,
 *     pam-absence-horizon). It seeds the agent count from the DB once, then
 *     tracks per-run inserts locally so N inserts in a single loop don't each
 *     need a fresh round-trip (and don't race the DB's read-after-write lag).
 *
 * Scope note (phase 1): the scheduled STANDING reports — pam-monday-digest,
 * mo-friday-scorecard, mo-content-runway-check — are the charter-mandated
 * once-per-cadence "Number, reported [Mondays/Fridays]". They surface a single
 * bounded row per run (the Monday digest sends one DM per person once a week),
 * so they are intentionally NOT gated by this budget — gating them would
 * wrongly suppress a legitimate weekly report. Only the event-driven per-item
 * loops are gated.
 */

import {
  getRecentInterventionCount,
  getRecentInterventionCountForHuman,
  type InterventionAgent,
} from "@/lib/supabase/agent-interventions";

export const AGENT_DAILY_CAP = 3;
export const HUMAN_DAILY_CAP = 5;

/**
 * One-shot budget check. Returns true if surfacing another non-silent
 * intervention for this agent (and optional target human) would exceed the
 * daily caps. Short-circuits on the agent cap before touching the human count.
 */
export async function isOverNotificationBudget(
  agent: InterventionAgent,
  targetHuman?: string | null,
): Promise<boolean> {
  const agentCount = await getRecentInterventionCount(agent);
  if (agentCount >= AGENT_DAILY_CAP) return true;
  if (targetHuman) {
    const humanCount = await getRecentInterventionCountForHuman(targetHuman);
    if (humanCount >= HUMAN_DAILY_CAP) return true;
  }
  return false;
}

/**
 * Stateful budget tracker for a single cron run that may surface many
 * interventions. Seed once with load(), then per candidate:
 *   const over = await budget.wouldExceed(email);   // check BEFORE inserting
 *   const row = await insertIntervention({ ... });   // insert regardless
 *   if (row) budget.record(email);                   // this row now counts
 *   if (over) continue;                              // skip the post only
 *
 * Mirrors the DB semantics: the agent count is read once from Supabase at
 * load() and incremented locally per insert; per-human counts are read lazily
 * (and cached) the first time an email is seen.
 */
export class NotificationBudget {
  private agentConsumed = 0;
  private readonly humanStart = new Map<string, number>();
  private readonly humanConsumed = new Map<string, number>();

  private constructor(
    private readonly agent: InterventionAgent,
    private readonly agentStart: number,
  ) {}

  static async load(agent: InterventionAgent): Promise<NotificationBudget> {
    const agentStart = await getRecentInterventionCount(agent);
    return new NotificationBudget(agent, agentStart);
  }

  private async humanStartFor(email: string): Promise<number> {
    const key = email.toLowerCase();
    if (!this.humanStart.has(key)) {
      this.humanStart.set(key, await getRecentInterventionCountForHuman(key));
    }
    return this.humanStart.get(key)!;
  }

  /** True if surfacing (posting) one more for this human would break a cap. */
  async wouldExceed(targetHuman?: string | null): Promise<boolean> {
    if (this.agentStart + this.agentConsumed >= AGENT_DAILY_CAP) return true;
    if (targetHuman) {
      const key = targetHuman.toLowerCase();
      const start = await this.humanStartFor(key);
      const consumed = this.humanConsumed.get(key) ?? 0;
      if (start + consumed >= HUMAN_DAILY_CAP) return true;
    }
    return false;
  }

  /** Record that a non-silent row was inserted this run (posted or not). */
  record(targetHuman?: string | null): void {
    this.agentConsumed += 1;
    if (targetHuman) {
      const key = targetHuman.toLowerCase();
      this.humanConsumed.set(key, (this.humanConsumed.get(key) ?? 0) + 1);
    }
  }
}

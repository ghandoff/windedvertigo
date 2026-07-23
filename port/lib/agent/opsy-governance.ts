/**
 * Opsy's governance / initiative-quality layer (charter: "initiative-quality
 * metrics for all agents · an agent trending noisy/quiet/wrong →
 * threshold-tuning proposal · graduation candidates after ~100 clean
 * instances → proposal to Garrett"). Shared rule: "Autonomy graduates per
 * ACTION TYPE (not per agent) after ~100 clean instances with low error +
 * low false-escalation rates; graduations proposed by Opsy, approved by
 * Garrett."
 *
 * This module is pure classification + rendering over ActionTypeMetrics — no
 * I/O, no Slack, no Claude. The cron (app/api/cron/opsy-initiative-metrics)
 * fetches the metrics, calls classifyGovernance(), renders the digest, and
 * surfaces it through the ambient spine as a LOW-tier Opsy intervention.
 *
 * IMPORTANT: nothing here *acts*. Granting a standing permission means editing
 * the Garrett-only charter (docs/agents/executive-charters.md) then
 * `npm run sync:charters` — no code path can auto-grant autonomy. So every
 * output is a PROPOSAL to Garrett, never an executable card.
 *
 * The thresholds below are Opsy's *proposal* thresholds — tunable here, and
 * distinct from the charter (charter text stays Garrett-only). Tighten/loosen
 * as real data accumulates.
 */

import type { ActionTypeMetrics, InterventionAgent } from "@/lib/supabase/agent-interventions";

// ── Graduation: "~100 clean instances with low error + low false-escalation" ──
export const GRADUATION_MIN_INSTANCES = 100;         // charter "~100 clean instances" (resolved rows)
export const GRADUATION_MIN_ACTED_RATE = 0.9;        // acted-upon (approved/edited/executed) ≥ 90%
export const GRADUATION_MAX_FALSE_ESCALATION_RATE = 0.05; // redirected ≤ 5%
export const GRADUATION_MAX_DISMISSED_RATE = 0.10;   // ignored ≤ 10%

// ── "Wrong": picking the wrong human/tier too often ───────────────────────────
export const WRONG_MIN_RESOLVED = 10;                // enough resolved to judge
export const WRONG_MIN_FALSE_ESCALATION_RATE = 0.20; // redirected ≥ 20%

// ── "Noisy": raising a lot that, once resolved, mostly isn't acted on ─────────
// Gated on RESOLVED (not total): an unresolved card is a pending decision, not
// a bad outcome — in sandbox nothing gets clicked, so resolved=0 keeps this
// correctly silent until real human responses accumulate.
export const NOISY_MIN_RESOLVED = 20;                // enough resolved to judge
export const NOISY_MAX_ACTED_RATE = 0.40;            // acted-upon ≤ 40% of resolved

// ── "Quiet": an agent expected to be firing that produced nothing ─────────────
export const QUIET_WINDOW_DAYS = 14;
// Agents with wired ambient behaviors today. Grow this list as Biz/cARL/Fin/
// Opsy gain spine-integrated behaviors — an agent not listed here can't be
// flagged "quiet" (it isn't expected to fire yet).
export const ACTIVE_AMBIENT_AGENTS: InterventionAgent[] = ["mo", "pam"];

export interface Governance {
  graduation: ActionTypeMetrics[];
  wrong: ActionTypeMetrics[];
  noisy: ActionTypeMetrics[];
  quiet: InterventionAgent[];
}

/**
 * Classify the 30-day per-action-type metrics into governance signals.
 * `recentNonSilentByAgent` counts non-silent interventions per agent over the
 * trailing QUIET_WINDOW_DAYS — used only for quiet detection (a value of 0 for
 * an ACTIVE_AMBIENT_AGENTS member is the signal).
 */
export function classifyGovernance(
  metrics: ActionTypeMetrics[],
  recentNonSilentByAgent: Record<string, number>,
): Governance {
  const graduation = metrics.filter(
    (m) =>
      m.resolved >= GRADUATION_MIN_INSTANCES &&
      m.actedUponRate >= GRADUATION_MIN_ACTED_RATE &&
      m.falseEscalationRate <= GRADUATION_MAX_FALSE_ESCALATION_RATE &&
      m.dismissedRate <= GRADUATION_MAX_DISMISSED_RATE,
  );
  const wrong = metrics.filter(
    (m) => m.resolved >= WRONG_MIN_RESOLVED && m.falseEscalationRate >= WRONG_MIN_FALSE_ESCALATION_RATE,
  );
  // Noisy is a distinct lens from wrong — exclude anything already flagged wrong
  // so each action-type is reported under its most actionable heading.
  const noisy = metrics.filter(
    (m) =>
      m.resolved >= NOISY_MIN_RESOLVED &&
      m.actedUponRate <= NOISY_MAX_ACTED_RATE &&
      !wrong.includes(m) &&
      !graduation.includes(m),
  );
  const quiet = ACTIVE_AMBIENT_AGENTS.filter((a) => (recentNonSilentByAgent[a] ?? 0) === 0);
  return { graduation, wrong, noisy, quiet };
}

/** True when there's nothing worth surfacing this run — Opsy stays terse. */
export function isGovernanceQuiet(gov: Governance): boolean {
  return (
    gov.graduation.length === 0 &&
    gov.wrong.length === 0 &&
    gov.noisy.length === 0 &&
    gov.quiet.length === 0
  );
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Render the weekly governance digest as Slack mrkdwn. `metrics` is the full
 * set (for the tracked-count footer); `days` documents the window.
 */
export function renderGovernanceDigest(gov: Governance, metrics: ActionTypeMetrics[], days: number): string {
  const lines: string[] = ["*🛰️ Opsy — weekly initiative-quality review*"];

  if (isGovernanceQuiet(gov)) {
    lines.push(
      `\nall quiet — ${metrics.length} action-type(s) tracked over ${days}d, none over a graduation/noise/error threshold yet.`,
    );
  } else {
    if (gov.graduation.length) {
      lines.push(`\n*✅ graduation candidates* (≥${GRADUATION_MIN_INSTANCES} clean instances)`);
      for (const m of gov.graduation) {
        lines.push(
          `  • \`${m.agent}\` · \`${m.actionType}\` — ${m.resolved} resolved, ${pct(m.actedUponRate)} acted-on, ${pct(m.falseEscalationRate)} false-escalation. *propose granting this action type standing autonomy.*`,
        );
      }
      lines.push(
        `  _to graduate: Garrett edits docs/agents/executive-charters.md → \`npm run sync:charters\` → redeploy (charter text is Garrett-only)._`,
      );
    }
    if (gov.wrong.length) {
      lines.push(`\n*🎯 mis-targeted* (high false-escalation — wrong human/tier)`);
      for (const m of gov.wrong) {
        lines.push(
          `  • \`${m.agent}\` · \`${m.actionType}\` — ${pct(m.falseEscalationRate)} redirected across ${m.resolved} resolved. review the target-human/tier logic.`,
        );
      }
    }
    if (gov.noisy.length) {
      lines.push(`\n*🔊 noisy* (high volume, low acted-on)`);
      for (const m of gov.noisy) {
        lines.push(
          `  • \`${m.agent}\` · \`${m.actionType}\` — ${m.total} raised, only ${pct(m.actedUponRate)} acted-on. consider tightening the trigger (proposal only).`,
        );
      }
    }
    if (gov.quiet.length) {
      lines.push(`\n*🤫 quiet* (0 interventions in ${QUIET_WINDOW_DAYS}d — check it's still firing)`);
      lines.push(`  • ${gov.quiet.map((a) => `\`${a}\``).join(", ")}`);
    }
  }

  lines.push(
    `\n_trigger: weekly initiative-quality sweep of agent_interventions (${days}d window, ${metrics.length} action-type(s)) · winded.vertigo ambient agents_`,
  );
  return lines.join("\n");
}

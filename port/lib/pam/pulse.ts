/**
 * Collective pulse — PaM's read-only window onto the whole collective.
 *
 * Composes existing read functions across biz, mo, cARL, opsy + AI usage into a
 * single lean shape: cross-system signal cards (that link out to each agent's
 * own page), this-week activity for the PEOPLE (commitments done / in flight),
 * and this-week activity + token spend for the AGENTS. Every read is wrapped so
 * a single failing source degrades to zero rather than breaking the page.
 */

import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { getSocialDraftsFromSupabase } from "@/lib/supabase/social";
import { getCarlFindings } from "@/lib/supabase/carl";
import { getCurriculum } from "@/lib/supabase/carl-curriculum";
import { buildHealthRollup, worstOf } from "@/lib/opsy/rollup";
import { getPamCommitments } from "@/lib/supabase/pam";
import { getAgentSpend } from "@/lib/ai/usage-by-agent";

export interface PulseSignal {
  key: "biz" | "mo" | "carl" | "opsy";
  href: string;
  line1: string;
  line2: string;
  tone: "danger" | "ok" | null;
}
export interface PulsePerson { who: string; done: number; inFlight: number }
export interface PulseAgent { agent: string; output: string; spendUsd: number }
export interface CollectivePulse {
  signals: PulseSignal[];
  people: PulsePerson[];
  agents: PulseAgent[];
  totalSpendUsd: number;
}

const ACTIVE_RFP = new Set(["radar", "reviewing", "pursuing", "interviewing", "submitted"]);

function money(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}

function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

export async function getCollectivePulse(currentCycle: string): Promise<CollectivePulse> {
  const fromIso = `${currentCycle}T00:00:00.000Z`;
  const toIso = new Date().toISOString();
  const weekStart = new Date(fromIso).getTime();
  const now = Date.now();
  const in7 = now + 7 * 86_400_000;

  const [rfp, campaigns, drafts, findings, covered, health, commitments, spend] = await Promise.all([
    getRfpOpportunitiesFromSupabase({}, { pageSize: 500 }).then((r) => r.data).catch(() => []),
    getCampaignsFromSupabase().catch(() => []),
    getSocialDraftsFromSupabase("draft").catch(() => []),
    getCarlFindings({ limit: 200 }).catch(() => []),
    getCurriculum({ status: "covered", limit: 500 }).catch(() => []),
    buildHealthRollup().catch(() => null),
    getPamCommitments({ limit: 300 }).catch(() => []),
    getAgentSpend(fromIso, toIso).catch(() => ({} as Record<string, { agent: string; spendUsd: number; calls: number }>)),
  ]);

  // ── biz ──
  const activeRfp = rfp.filter((o) => o.status && ACTIVE_RFP.has(o.status));
  const pipeline = activeRfp.reduce((s, o) => s + (o.estimatedValue ?? 0), 0);
  const dueSoon = activeRfp.filter((o) => {
    const t = o.dueDate?.start ? new Date(o.dueDate.start).getTime() : null;
    return t !== null && t <= in7 && t >= now - 86_400_000;
  });

  // ── mo ──
  const activeCampaigns = campaigns.filter((c) => c.status === "active");

  // ── carl ──
  const findingsWeek = findings.filter((f) => f.created_at && new Date(f.created_at).getTime() >= weekStart);
  const coveredWeek = covered.filter((t) => t.updated_at && new Date(t.updated_at).getTime() >= weekStart);

  // ── opsy ──
  let opsyLine1 = "health unknown";
  let openIncidents = 0;
  if (health) {
    const worst = worstOf(Object.values(health.platforms).map((p) => p.status));
    openIncidents = health.incidents_7d.filter((i) => i.status === "open").length;
    opsyLine1 = worst === "green" ? "all green" : worst;
  }

  const signals: PulseSignal[] = [
    {
      key: "biz",
      href: "/opportunities",
      line1: plural(dueSoon.length, "bid due", "bids due"),
      line2: `${plural(activeRfp.length, "in pipeline", "in pipeline")} · ${money(pipeline)}`,
      tone: dueSoon.length > 0 ? "danger" : null,
    },
    {
      key: "mo",
      href: "/mo",
      line1: plural(activeCampaigns.length, "campaign live", "campaigns live"),
      line2: plural(drafts.length, "draft in review", "drafts in review"),
      tone: null,
    },
    {
      key: "carl",
      href: "/carl",
      line1: plural(findingsWeek.length, "finding filed", "findings filed"),
      line2: plural(coveredWeek.length, "topic covered", "topics covered"),
      tone: null,
    },
    {
      key: "opsy",
      href: "/ops",
      line1: opsyLine1,
      line2: plural(openIncidents, "open incident", "open incidents"),
      tone: openIncidents > 0 ? "danger" : "ok",
    },
  ];

  // ── people (current cycle commitments) ──
  const byWho = new Map<string, { done: number; inFlight: number }>();
  for (const c of commitments) {
    if (c.cycle !== currentCycle) continue;
    if (!byWho.has(c.who)) byWho.set(c.who, { done: 0, inFlight: 0 });
    const b = byWho.get(c.who)!;
    if (c.status === "done") b.done++;
    else if (c.status !== "parked") b.inFlight++;
  }
  const people: PulsePerson[] = [...byWho.entries()]
    .map(([who, b]) => ({ who, ...b }))
    .sort((a, b) => a.who.localeCompare(b.who));

  // ── agents ──
  const calls = (a: string) => spend[a]?.calls ?? 0;
  const usd = (a: string) => spend[a]?.spendUsd ?? 0;
  const agents: PulseAgent[] = [
    { agent: "biz", output: plural(calls("biz"), "rfp/proposal run", "rfp/proposal runs"), spendUsd: usd("biz") },
    { agent: "carl", output: `${plural(findingsWeek.length, "finding")} · ${plural(coveredWeek.length, "topic")}`, spendUsd: usd("carl") },
    { agent: "pam", output: plural(calls("pam"), "triage run", "triage runs"), spendUsd: usd("pam") },
    { agent: "opsy", output: `${plural(calls("opsy"), "scan")} · ${plural(openIncidents, "incident")}`, spendUsd: usd("opsy") },
    { agent: "mo", output: `${plural(activeCampaigns.length, "campaign")} · ${plural(drafts.length, "draft")}`, spendUsd: usd("mo") },
  ];
  const totalSpendUsd = agents.reduce((s, a) => s + a.spendUsd, 0);

  return { signals, people, agents, totalSpendUsd };
}

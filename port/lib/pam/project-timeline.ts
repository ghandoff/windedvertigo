/**
 * Project-altitude timeline data for PaM — at the DELIVERABLE tier.
 *
 * The `projects` table is the programme/portfolio tier (LEAP 2025, PRME 2026,
 * the studios) — one level too high to plot usefully. The work that actually
 * has dates lives one level down in `milestones` (each with a parent project).
 * So the timeline rows are active deliverables grouped + coloured by their
 * parent programme, plus a "business development" lane of near-term RFP
 * deadlines (a separate pipeline that never enters projects/milestones).
 */

import { getProjectsFromSupabase } from "@/lib/supabase/projects";
import { getMilestonesFromSupabase } from "@/lib/supabase/milestones";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";

export interface TimelineItem {
  name: string;
  start: string | null;
  end: string | null;
}

export interface TimelineGroup {
  program: string;
  tier: string; // "contract" | "studio" | "business development"
  fill: string; // light bar fill
  mark: string; // darker — diamonds, dot, group accent
  items: TimelineItem[];
}

const PALETTE = [
  { fill: "#85B7EB", mark: "#185FA5" }, // blue
  { fill: "#5DCAA5", mark: "#0F6E56" }, // teal
  { fill: "#AFA9EC", mark: "#534AB7" }, // violet
  { fill: "#F0997B", mark: "#D85A30" }, // coral
  { fill: "#ED93B1", mark: "#D4537E" }, // pink
  { fill: "#C0DD97", mark: "#639922" }, // green
];
const RFP_COLOUR = { fill: "#FAC775", mark: "#BA7517" }; // amber — reserved for the rfp lane
const ACTIVE_RFP = new Set(["radar", "reviewing", "pursuing", "interviewing", "submitted", ""]);

/** payment / drawdown milestones aren't deliverables — keep them off the chart. */
function isPayment(name: string): boolean {
  return /payment|\(\s*\d+\s*%\s*\)/i.test(name);
}

/** RFP names are long; pick the shortest dash-segment (usually the client/org). */
function shortRfp(name: string): string {
  const parts = name.split(/\s[—–-]\s/).map((s) => s.trim()).filter(Boolean);
  const best = (parts.sort((a, b) => a.length - b.length)[0] || name).trim();
  return (best.length > 42 ? best.slice(0, 42) + "…" : best).toLowerCase();
}

export async function getProjectTimeline(): Promise<TimelineGroup[]> {
  const [projects, milestones, rfp] = await Promise.all([
    getProjectsFromSupabase({ archive: false }, { pageSize: 100 }).then((r) => r.data).catch(() => []),
    getMilestonesFromSupabase({}, { pageSize: 500 }).then((r) => r.data).catch(() => []),
    getRfpOpportunitiesFromSupabase({}, { pageSize: 500 }).then((r) => r.data).catch(() => []),
  ]);

  const projById = new Map(projects.map((p) => [p.id, p]));

  // active deliverable milestones, grouped by parent programme
  const byProgram = new Map<string, { tier: string; items: TimelineItem[] }>();
  for (const m of milestones) {
    if (m.archive || m.milestoneStatus === "complete") continue;
    if (isPayment(m.milestone)) continue;
    if (!m.startDate && !m.endDate) continue;
    const parent = m.projectIds.map((id) => projById.get(id)).find(Boolean);
    if (!parent) continue;
    if (!byProgram.has(parent.project)) byProgram.set(parent.project, { tier: parent.type ?? "project", items: [] });
    byProgram.get(parent.project)!.items.push({ name: m.milestone, start: m.startDate, end: m.endDate });
  }

  // contracts first, then studios, alphabetical within; colour per programme
  const ordered = [...byProgram.entries()].sort((a, b) => {
    const rank = (t: string) => (t === "contract" ? 0 : t === "studio" ? 1 : 2);
    return rank(a[1].tier) - rank(b[1].tier) || a[0].localeCompare(b[0]);
  });
  const groups: TimelineGroup[] = ordered.map(([program, g], i) => ({
    program,
    tier: g.tier,
    ...PALETTE[i % PALETTE.length],
    items: g.items.sort((x, y) => (x.start ?? "").localeCompare(y.start ?? "")),
  }));

  // business-development lane — near-term active RFP deadlines (separate pipeline)
  const now = Date.now();
  const horizon = now + 120 * 86_400_000;
  const rfpItems: TimelineItem[] = rfp
    .filter((o) => o.status !== null && ACTIVE_RFP.has(o.status) && o.dueDate?.start)
    .filter((o) => {
      const t = new Date(o.dueDate!.start).getTime();
      return t >= now - 7 * 86_400_000 && t <= horizon;
    })
    .sort((a, b) => new Date(a.dueDate!.start).getTime() - new Date(b.dueDate!.start).getTime())
    .slice(0, 8)
    .map((o) => ({ name: shortRfp(o.opportunityName), start: o.dueDate!.start, end: null }));
  if (rfpItems.length) {
    groups.push({ program: "business development", tier: "rfp lane", ...RFP_COLOUR, items: rfpItems });
  }

  return groups;
}

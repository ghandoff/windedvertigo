/**
 * Project-altitude timeline data for PaM.
 *
 * Lifts the gantt from per-task to per-PROJECT: a handful of bars showing what's
 * in flight and coming up, with each project's milestones attached for an
 * on-demand drill-in. Reuses the same project/milestone reads `/projects` uses.
 */

import { getProjectsFromSupabase } from "@/lib/supabase/projects";
import { getMilestonesFromSupabase } from "@/lib/supabase/milestones";

export interface TimelineMilestone {
  name: string;
  date: string | null;
  status: string;
}

export interface TimelineProject {
  id: string;
  name: string;
  status: string;
  type: string | null;
  start: string; // ISO date — guaranteed present (filtered)
  end: string | null;
  milestones: TimelineMilestone[];
}

export async function getProjectTimeline(): Promise<TimelineProject[]> {
  const [projects, milestones] = await Promise.all([
    getProjectsFromSupabase({ archive: false }, { pageSize: 100 }).then((r) => r.data).catch(() => []),
    getMilestonesFromSupabase({}, { pageSize: 500 }).then((r) => r.data).catch(() => []),
  ]);

  const byProject = new Map<string, TimelineMilestone[]>();
  for (const m of milestones) {
    const date = m.startDate ?? m.endDate ?? null;
    for (const pid of m.projectIds) {
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid)!.push({ name: m.milestone, date, status: m.milestoneStatus });
    }
  }

  return projects
    .filter((p) => p.timeline?.start)
    .map((p) => ({
      id: p.id,
      name: p.project,
      status: p.status,
      type: p.type,
      start: p.timeline!.start,
      end: p.timeline!.end,
      milestones: (byProject.get(p.id) ?? []).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

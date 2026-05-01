"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Diamond,
  ExternalLink,
  Hand,
  Loader2,
  Users,
} from "lucide-react";
import type {
  Project,
  ProjectStatus,
  Milestone,
  MilestoneStatus,
  WorkItem,
} from "@/lib/notion/types";
import type { Member } from "@/lib/notion/members";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * ProjectsTimeline — rows-by-project, two shapes per row.
 *
 *   rows    = projects
 *   phases  = horizontal bars (kind === "phase") spanning startDate → endDate
 *   miles   = diamonds (kind === "milestone") at startDate or endDate
 *   today   = vertical line across all rows
 *   signal  = help-wanted dot on diamonds with unassigned or blocked tasks
 *   hover   = mini-taskboard preview of the milestone's tasks (desktop)
 *   tap     = full modal with tasks + claim buttons
 */

const TIMELINE_DAYS_PAST = 30;
const TIMELINE_DAYS_FUTURE = 330;
const PX_PER_DAY = 12;

// ── status → colour map ──────────────────────────────────────────

const PROJECT_STATUS_BADGE: Record<ProjectStatus, { label: string; className: string }> = {
  "icebox": { label: "icebox", className: "bg-muted text-muted-foreground" },
  "in queue": { label: "queued", className: "bg-muted text-muted-foreground" },
  "in progress": {
    label: "in progress",
    className: "bg-[var(--chart-3)]/20 text-[var(--chart-3)] border border-[var(--chart-3)]/40",
  },
  "under review": {
    label: "review",
    className: "bg-amber-100 text-amber-800 border border-amber-300",
  },
  "suspended": {
    label: "suspended",
    className: "bg-muted/60 text-muted-foreground italic",
  },
  "complete": {
    label: "complete",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  },
  "cancelled": {
    label: "cancelled",
    className: "bg-destructive/15 text-destructive border border-destructive/30",
  },
};

const MILESTONE_STATUS_FILL: Record<MilestoneStatus, string> = {
  "not started": "fill-muted-foreground text-muted-foreground",
  "in progress": "fill-[var(--chart-3)] text-[var(--chart-3)]",
  "complete": "fill-emerald-500 text-emerald-500",
  "blocked": "fill-destructive text-destructive",
};

// Never return undefined — unknown statuses fall back to the neutral style
// so a schema drift can't crash the render.
function fillClassFor(status: MilestoneStatus | string | undefined): string {
  return (status && MILESTONE_STATUS_FILL[status as MilestoneStatus]) || MILESTONE_STATUS_FILL["not started"];
}

// ── date helpers ─────────────────────────────────────────────────

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysFromNow(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatRelative(days: number, isComplete = false): string {
  if (isComplete) return "done";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days}d`;
  if (days < 30) return `in ${Math.round(days / 7)}w`;
  return `in ${Math.round(days / 30)}mo`;
}

function dateToFraction(date: Date, min: Date, max: Date): number {
  const span = max.getTime() - min.getTime();
  if (span <= 0) return 0;
  const f = (date.getTime() - min.getTime()) / span;
  return Math.max(0, Math.min(1, f));
}

/**
 * Anchor date for a row. Phases use endDate (the "finish" — where the diamond
 * would sit if it were a milestone); milestones use startDate (zero-duration).
 * Falls back across both fields for resilience.
 */
function getMilestoneDate(m: Milestone): Date | null {
  return parseDate(m.endDate) ?? parseDate(m.startDate);
}

// ── derived task classification ─────────────────────────────────

type TaskKind = "available" | "blocked" | "in-motion" | "complete";

function classifyTask(wi: WorkItem): TaskKind {
  if (wi.status === "complete") return "complete";
  if (wi.blockedByIds.length > 0) return "blocked";
  if (wi.ownerIds.length === 0 || wi.status === "in queue" || wi.status === "icebox") {
    return "available";
  }
  return "in-motion";
}

// ── props ────────────────────────────────────────────────────────

interface ProjectsTimelineProps {
  projects: Project[];
  milestones: Milestone[];
  members: Member[];
  /** Map of milestoneId → WorkItems pointing at it (computed server-side) */
  milestoneTaskMap?: Record<string, WorkItem[]>;
  /** Current signed-in user's Notion member id, for the "I'll take this" button */
  currentUserId?: string | null;
  /** Map of projectId → total billable hours logged (for future burn visualisation) */
  projectBurnMap?: Map<string, number>;
}

// ── main component ───────────────────────────────────────────────

export function ProjectsTimeline({
  projects,
  milestones,
  members,
  milestoneTaskMap = {},
  currentUserId = null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectBurnMap,
}: ProjectsTimelineProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "contract" | "studio">("all");
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  // Only keep active-ish projects for the timeline
  const eligibleProjects = useMemo(
    () =>
      projects
        .filter((p) => !p.archive)
        .filter((p) => p.status !== "cancelled" && p.status !== "icebox")
        .filter((p) => typeFilter === "all" || p.type === typeFilter)
        .filter((p) => milestones.some((m) => m.projectIds.includes(p.id))),
    [projects, milestones, typeFilter],
  );

  const { viewMin, viewMax, timelineWidth } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const min = new Date(today);
    min.setDate(min.getDate() - TIMELINE_DAYS_PAST);
    const max = new Date(today);
    max.setDate(max.getDate() + TIMELINE_DAYS_FUTURE);
    const width = (TIMELINE_DAYS_PAST + TIMELINE_DAYS_FUTURE) * PX_PER_DAY;
    return { viewMin: min, viewMax: max, timelineWidth: width };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = Math.max(0, (TIMELINE_DAYS_PAST - 7) * PX_PER_DAY);
    el.scrollLeft = offset;
  }, []);

  // Group milestones by their first project
  const projectRows = useMemo(() => {
    const map = new Map<string, { project: Project; milestones: Milestone[] }>();
    for (const p of eligibleProjects) {
      map.set(p.id, { project: p, milestones: [] });
    }
    for (const m of milestones) {
      for (const pid of m.projectIds) {
        const entry = map.get(pid);
        if (!entry) continue;
        entry.milestones.push(m);
      }
    }
    // Sort projects by their earliest upcoming milestone
    return Array.from(map.values())
      .filter((r) => r.milestones.length > 0)
      .sort((a, b) => {
        const aNext = soonestMilestoneDate(a.milestones);
        const bNext = soonestMilestoneDate(b.milestones);
        return (aNext?.getTime() ?? Infinity) - (bNext?.getTime() ?? Infinity);
      });
  }, [eligibleProjects, milestones]);

  // This-week items: milestones due in next 7 days (not complete)
  const thisWeek = useMemo(() => {
    const projectById = new Map(projects.map((p) => [p.id, p]));
    type Row = {
      milestone: Milestone;
      date: Date;
      days: number;
      project: Project | undefined;
    };
    const rows: Row[] = [];
    for (const m of milestones) {
      const d = getMilestoneDate(m);
      if (!d) continue;
      const days = daysFromNow(d);
      if (days < -1 || days > 7) continue;
      if (m.milestoneStatus === "complete") continue;
      const pid = m.projectIds[0];
      rows.push({ milestone: m, date: d, days, project: pid ? projectById.get(pid) : undefined });
    }
    rows.sort((a, b) => a.days - b.days);
    return rows;
  }, [milestones, projects]);

  const todayFrac = useMemo(
    () => dateToFraction(new Date(), viewMin, viewMax),
    [viewMin, viewMax],
  );

  const weekTicks = useMemo(() => {
    const ticks: { label: string; frac: number }[] = [];
    const cursor = new Date(viewMin);
    const dow = cursor.getDay();
    const daysToMonday = (8 - (dow || 7)) % 7;
    cursor.setDate(cursor.getDate() + daysToMonday);
    while (cursor <= viewMax) {
      ticks.push({
        label: formatShortDate(cursor),
        frac: dateToFraction(cursor, viewMin, viewMax),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return ticks;
  }, [viewMin, viewMax]);

  const activeMilestone = useMemo(
    () => milestones.find((m) => m.id === activeMilestoneId) ?? null,
    [activeMilestoneId, milestones],
  );
  const activeMilestoneProject = useMemo(() => {
    if (!activeMilestone) return null;
    const pid = activeMilestone.projectIds[0];
    return projects.find((p) => p.id === pid) ?? null;
  }, [activeMilestone, projects]);

  return (
    <div className="space-y-6">
      <ThisWeekStrip rows={thisWeek} onSelectMilestone={setActiveMilestoneId} />

      <Card>
        <CardContent className="p-0">
          <Controls
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            projectCount={projectRows.length}
            totalProjectCount={projects.filter((p) => !p.archive).length}
          />

          {projectRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              no projects with upcoming milestones. try a different type filter.
            </div>
          ) : (
            <div ref={scrollRef} className="overflow-x-auto">
              <div className="flex flex-col" style={{ minWidth: `${224 + timelineWidth}px` }}>
                <div className="flex items-stretch h-10 border-b border-border">
                  <div className="shrink-0 w-56 sticky left-0 z-20 bg-card border-r border-border" aria-hidden="true" />
                  <div className="relative shrink-0" style={{ width: `${timelineWidth}px` }}>
                    {weekTicks.map((t, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-l border-border/50"
                        style={{ left: `${t.frac * 100}%` }}
                      >
                        <span className="absolute top-1 left-1 text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                          {t.label}
                        </span>
                      </div>
                    ))}
                    <TodayLine frac={todayFrac} />
                  </div>
                </div>
                {projectRows.map((row, idx) => (
                  <ProjectRow
                    key={row.project.id}
                    project={row.project}
                    milestones={row.milestones}
                    viewMin={viewMin}
                    viewMax={viewMax}
                    todayFrac={todayFrac}
                    timelineWidth={timelineWidth}
                    memberById={memberById}
                    milestoneTaskMap={milestoneTaskMap}
                    onSelectMilestone={setActiveMilestoneId}
                    preferTooltipBelow={idx === 0}
                  />
                ))}
              </div>
            </div>
          )}

          <Legend />
        </CardContent>
      </Card>

      {activeMilestone && (
        <MilestoneModal
          milestone={activeMilestone}
          project={activeMilestoneProject}
          tasks={milestoneTaskMap[activeMilestone.id] ?? []}
          members={members}
          memberById={memberById}
          currentUserId={currentUserId}
          onClose={() => setActiveMilestoneId(null)}
        />
      )}
    </div>
  );
}

function soonestMilestoneDate(ms: Milestone[]): Date | null {
  let best: Date | null = null;
  for (const m of ms) {
    const d = getMilestoneDate(m);
    if (!d) continue;
    if (m.milestoneStatus === "complete") continue;
    if (!best || d < best) best = d;
  }
  return best;
}

// ── sub-components ───────────────────────────────────────────────

function Controls({
  typeFilter,
  onTypeFilterChange,
  projectCount,
  totalProjectCount,
}: {
  typeFilter: "all" | "contract" | "studio";
  onTypeFilterChange: (f: "all" | "contract" | "studio") => void;
  projectCount: number;
  totalProjectCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">
          {projectCount} of {totalProjectCount} projects with upcoming milestones
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">· scroll horizontally to move beyond the 3-month window</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["all", "contract", "studio"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeFilterChange(t)}
              className={cn(
                "px-3 py-1 text-xs transition-colors",
                typeFilter === t ? "bg-accent text-white" : "bg-background hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TodayLine({ frac }: { frac: number }) {
  if (frac <= 0 || frac >= 1) return null;
  return (
    <>
      <div
        className="absolute top-0 bottom-0 w-px bg-accent/80 pointer-events-none z-10"
        style={{ left: `${frac * 100}%` }}
        aria-hidden="true"
      />
      <div
        className="absolute -top-0.5 -translate-x-1/2 z-10 pointer-events-none"
        style={{ left: `${frac * 100}%` }}
      >
        <div className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
      </div>
    </>
  );
}

function ProjectRow({
  project,
  milestones,
  viewMin,
  viewMax,
  todayFrac,
  timelineWidth,
  memberById,
  milestoneTaskMap,
  onSelectMilestone,
  preferTooltipBelow,
}: {
  project: Project;
  milestones: Milestone[];
  viewMin: Date;
  viewMax: Date;
  todayFrac: number;
  timelineWidth: number;
  memberById: Map<string, Member>;
  milestoneTaskMap: Record<string, WorkItem[]>;
  onSelectMilestone: (id: string) => void;
  preferTooltipBelow: boolean;
}) {
  const leadName =
    project.projectLeadIds.length > 0
      ? memberById.get(project.projectLeadIds[0])?.name ?? "unknown"
      : null;
  const badge = PROJECT_STATUS_BADGE[project.status];

  return (
    <div className="border-b border-border last:border-b-0 flex items-stretch group hover:bg-muted/20 transition-colors">
      <div className="shrink-0 w-56 px-3 py-2 sticky left-0 z-20 bg-card border-r border-border flex flex-col justify-center">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium truncate hover:text-accent transition-colors"
        >
          {project.project}
        </Link>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide", badge.className)}
          >
            {badge.label}
          </span>
          {leadName && (
            <span className="text-[10px] text-muted-foreground truncate">· {leadName}</span>
          )}
        </div>
      </div>

      <div className="relative h-14 shrink-0" style={{ width: `${timelineWidth}px` }}>
        {todayFrac > 0 && todayFrac < 1 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-accent/40 pointer-events-none"
            style={{ left: `${todayFrac * 100}%` }}
            aria-hidden="true"
          />
        )}
        {milestones.map((m) =>
          m.kind === "phase" ? (
            <PhaseBar
              key={m.id}
              milestone={m}
              viewMin={viewMin}
              viewMax={viewMax}
              taskCount={milestoneTaskMap[m.id]?.length ?? 0}
              onSelect={() => onSelectMilestone(m.id)}
            />
          ) : (
            <MilestoneDiamond
              key={m.id}
              milestone={m}
              viewMin={viewMin}
              viewMax={viewMax}
              tasks={milestoneTaskMap[m.id] ?? []}
              memberById={memberById}
              onSelect={() => onSelectMilestone(m.id)}
              preferTooltipBelow={preferTooltipBelow}
            />
          ),
        )}
        <UndatedMilestoneIndicator
          milestones={milestones.filter((m) => !getMilestoneDate(m))}
          onSelect={onSelectMilestone}
        />
      </div>
    </div>
  );
}

function UndatedMilestoneIndicator({
  milestones,
  onSelect,
}: {
  milestones: Milestone[];
  onSelect: (id: string) => void;
}) {
  if (milestones.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => onSelect(milestones[0].id)}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-accent hover:text-accent transition-colors"
      title={`${milestones.length} milestone${milestones.length === 1 ? "" : "s"} with no date`}
    >
      {milestones.length} undated
    </button>
  );
}

function PhaseBar({
  milestone,
  viewMin,
  viewMax,
  taskCount,
  onSelect,
}: {
  milestone: Milestone;
  viewMin: Date;
  viewMax: Date;
  taskCount: number;
  onSelect: () => void;
}) {
  const start = parseDate(milestone.startDate);
  const end = parseDate(milestone.endDate);
  // A phase needs both ends. If only one is set, fall back to a point render.
  if (!start || !end || end.getTime() < start.getTime()) return null;

  const startFrac = dateToFraction(start, viewMin, viewMax);
  const endFrac = dateToFraction(end, viewMin, viewMax);
  const widthPct = Math.max(0.5, (endFrac - startFrac) * 100);

  const fillClass = fillClassFor(milestone.milestoneStatus);
  // MILESTONE_STATUS_FILL entries look like "fill-... text-..."; derive a bg
  // class from the text-* token so the bar reads as a coloured ribbon.
  const bgToken = fillClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-muted-foreground";
  const bgClass = bgToken.replace("text-", "bg-");

  return (
    <button
      type="button"
      onClick={onSelect}
      className="absolute top-1/2 -translate-y-1/2 h-5 z-10 rounded-sm border border-border/60 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 transition-colors overflow-hidden group/phase"
      style={{ left: `${startFrac * 100}%`, width: `${widthPct}%` }}
      aria-label={`phase: ${milestone.milestone} from ${formatShortDate(start)} to ${formatShortDate(end)}`}
      title={`${milestone.milestone} · ${taskCount} ${taskCount === 1 ? "task" : "tasks"}`}
    >
      <div className={cn("absolute inset-0 opacity-30", bgClass)} aria-hidden="true" />
      <span className="relative z-10 px-2 text-[10px] font-medium uppercase tracking-wide text-foreground/80 group-hover/phase:text-foreground truncate block leading-5">
        {milestone.milestone}
      </span>
    </button>
  );
}

function MilestoneDiamond({
  milestone,
  viewMin,
  viewMax,
  tasks,
  memberById,
  onSelect,
  preferTooltipBelow,
}: {
  milestone: Milestone;
  viewMin: Date;
  viewMax: Date;
  tasks: WorkItem[];
  memberById: Map<string, Member>;
  onSelect: () => void;
  preferTooltipBelow: boolean;
}) {
  const d = getMilestoneDate(milestone);
  if (!d) return null;
  // Clamp to viewport edges so out-of-range milestones still show up as
  // edge pins. Opacity dims so they don't distract from in-range work.
  const rawFrac = (d.getTime() - viewMin.getTime()) / (viewMax.getTime() - viewMin.getTime());
  const outOfRange = rawFrac <= 0 || rawFrac >= 1;
  const frac = Math.max(0.005, Math.min(0.995, rawFrac));

  const unassignedCount = tasks.filter((t) => classifyTask(t) === "available").length;
  const blockedCount = tasks.filter((t) => classifyTask(t) === "blocked").length;
  const helpWanted = unassignedCount > 0 || blockedCount > 0;

  const fillClass = fillClassFor(milestone.milestoneStatus);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group/diamond focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm"
      style={{ left: `${frac * 100}%` }}
      aria-label={`milestone: ${milestone.milestone} on ${formatShortDate(d)}`}
    >
      <div className={cn("relative", outOfRange && "opacity-40")}>
        <Diamond className={cn("h-4 w-4 transition-transform group-hover/diamond:scale-125", fillClass)} />
        {helpWanted && (
          <span
            className={cn(
              "absolute -top-1 -right-1 h-2 w-2 rounded-full border border-background",
              blockedCount > 0 ? "bg-destructive" : "bg-accent",
            )}
            aria-hidden="true"
          />
        )}
      </div>

      <HoverPreview
        milestone={milestone}
        tasks={tasks}
        date={d}
        memberById={memberById}
        placeBelow={preferTooltipBelow}
      />
    </button>
  );
}

function HoverPreview({
  milestone,
  tasks,
  date,
  memberById,
  placeBelow,
}: {
  milestone: Milestone;
  tasks: WorkItem[];
  date: Date;
  memberById: Map<string, Member>;
  placeBelow: boolean;
}) {
  const classified = tasks.map((t) => ({ task: t, kind: classifyTask(t) }));
  const available = classified.filter((x) => x.kind === "available").length;
  const days = daysFromNow(date);
  const isComplete = milestone.milestoneStatus === "complete";

  return (
    <div
      className={cn(
        "hidden md:block absolute left-1/2 -translate-x-1/2 z-30 opacity-0 pointer-events-none group-hover/diamond:opacity-100 transition-opacity duration-150",
        placeBelow ? "top-full mt-2" : "bottom-full mb-2",
      )}
      role="tooltip"
    >
      <div className="bg-popover text-popover-foreground rounded-md shadow-lg border border-border w-64 text-left">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-sm font-medium truncate">{milestone.milestone}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatRelative(days, isComplete)} · {formatShortDate(date)}
          </div>
        </div>
        {tasks.length > 0 ? (
          <>
            <ul className="py-1 max-h-40 overflow-y-auto">
              {classified.slice(0, 5).map(({ task, kind }) => {
                const owner = task.ownerIds[0] ? memberById.get(task.ownerIds[0]) : null;
                return (
                  <li key={task.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotForKind(kind))} aria-hidden="true" />
                    <span className="truncate flex-1">{task.task}</span>
                    <span className="text-muted-foreground truncate max-w-16">
                      {owner?.name.split(" ")[0]?.toLowerCase() ?? "—"}
                    </span>
                  </li>
                );
              })}
              {classified.length > 5 && (
                <li className="px-3 py-1 text-xs text-muted-foreground italic">
                  +{classified.length - 5} more
                </li>
              )}
            </ul>
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              {available > 0 && (
                <span className="text-accent font-medium"> · {available} unclaimed</span>
              )}
              <span className="text-muted-foreground/70"> · click for details</span>
            </div>
          </>
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">
            no tasks tied to this milestone yet.
          </div>
        )}
      </div>
    </div>
  );
}

function dotForKind(kind: TaskKind): string {
  switch (kind) {
    case "available": return "bg-accent";
    case "blocked": return "bg-destructive";
    case "in-motion": return "bg-[var(--chart-3)]";
    case "complete": return "bg-emerald-500";
  }
}

// ── modal ─────────────────────────────────────────────────────────

function MilestoneModal({
  milestone,
  project,
  tasks,
  members,
  memberById,
  currentUserId,
  onClose,
}: {
  milestone: Milestone;
  project: Project | null;
  tasks: WorkItem[];
  members: Member[];
  memberById: Map<string, Member>;
  currentUserId: string | null;
  onClose: () => void;
}) {
  // void to silence unused — kept in props for future "link to member profile" features
  void members;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const d = getMilestoneDate(milestone);
  const days = d ? daysFromNow(d) : null;
  const overdue = days !== null && days < 0 && milestone.milestoneStatus !== "complete";

  const classified = tasks.map((t) => ({ task: t, kind: classifyTask(t) }));
  const available = classified.filter((x) => x.kind === "available");
  const inMotion = classified.filter((x) => x.kind === "in-motion");
  const blocked = classified.filter((x) => x.kind === "blocked");
  const complete = classified.filter((x) => x.kind === "complete");

  const ownerName =
    milestone.ownerIds[0] ? memberById.get(milestone.ownerIds[0])?.name : null;

  const claimTask = useCallback(async (taskId: string) => {
    setClaiming(taskId);
    setClaimError(null);
    try {
      const res = await fetch(`/api/work-items/${taskId}/claim`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "failed" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // refresh server data so the task now shows you as the owner
      startTransition(() => router.refresh());
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "couldn't claim task");
    } finally {
      setClaiming(null);
    }
  }, [router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-xl">{milestone.milestone}</DialogTitle>
            <Badge variant="secondary" className="text-xs">
              {milestone.kind}
            </Badge>
          </div>
          <DialogDescription className="flex items-center flex-wrap gap-2 text-sm">
            {d && (
              <span className={cn(overdue && "text-destructive font-medium")}>
                {formatRelative(days!, milestone.milestoneStatus === "complete")} · {formatShortDate(d)}
              </span>
            )}
            {project && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-accent hover:underline"
                >
                  {project.project}
                </Link>
              </>
            )}
            {ownerName && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">lead: {ownerName.toLowerCase()}</span>
              </>
            )}
            <span className="text-muted-foreground/60">·</span>
            <span className={fillClassFor(milestone.milestoneStatus).replace("fill-", "text-").split(" ")[0]}>
              {milestone.milestoneStatus}
            </span>
          </DialogDescription>
        </DialogHeader>

        {milestone.description && (
          <div className="text-sm text-foreground/90">{milestone.description}</div>
        )}

        {claimError && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-3 py-2">
            {claimError}
          </div>
        )}

        {/* Pattern B main body — inverted grouping:
            "how to chip in" first, then "in motion", then "complete". */}
        {available.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Hand className="h-4 w-4 text-accent" aria-hidden="true" />
              how to chip in
              <Badge className="ml-auto">{available.length} available</Badge>
            </h3>
            <ul className="space-y-2">
              {available.map(({ task }) => (
                <AvailableTaskRow
                  key={task.id}
                  task={task}
                  claiming={claiming === task.id}
                  disabled={!currentUserId || claiming !== null}
                  onClaim={() => claimTask(task.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {blocked.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
              <span className="h-2 w-2 bg-destructive rounded-full" aria-hidden="true" />
              blocked ({blocked.length})
            </h3>
            <ul className="space-y-1">
              {blocked.map(({ task }) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{task.task}</span>
                  <OwnerAvatar ownerIds={task.ownerIds} memberById={memberById} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {inMotion.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
              <span className="h-2 w-2 bg-[var(--chart-3)] rounded-full" aria-hidden="true" />
              in motion ({inMotion.length})
            </h3>
            <ul className="space-y-1">
              {inMotion.map(({ task }) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--chart-3)] shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{task.task}</span>
                  <OwnerAvatar ownerIds={task.ownerIds} memberById={memberById} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {complete.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground">
              <span className="h-2 w-2 bg-emerald-500 rounded-full" aria-hidden="true" />
              complete ({complete.length})
            </h3>
            <ul className="space-y-1">
              {complete.map(({ task }) => (
                <li key={task.id} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{task.task}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            no tasks have been tied to this milestone yet. add tasks in notion
            and link them via the milestone relation.
          </p>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(
                `https://www.notion.so/${milestone.id.replace(/-/g, "")}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
            open in notion
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AvailableTaskRow({
  task,
  claiming,
  disabled,
  onClaim,
}: {
  task: WorkItem;
  claiming: boolean;
  disabled: boolean;
  onClaim: () => void;
}) {
  const dueDate = parseDate(task.dueDate?.end) ?? parseDate(task.dueDate?.start);
  const due = dueDate ? daysFromNow(dueDate) : null;
  return (
    <li className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{task.task}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="uppercase tracking-widest text-[10px]">{task.priority}</span>
          {dueDate && <span>· due {formatShortDate(dueDate)}{due !== null && ` (${formatRelative(due)})`}</span>}
          {task.estimateHours != null && <span>· est {task.estimateHours}h</span>}
        </div>
      </div>
      <Button
        size="sm"
        onClick={onClaim}
        disabled={disabled}
        className="shrink-0 gap-1.5"
      >
        {claiming ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            claiming…
          </>
        ) : (
          <>
            <Hand className="h-3.5 w-3.5" aria-hidden="true" />
            I&apos;ll take this
          </>
        )}
      </Button>
    </li>
  );
}

function OwnerAvatar({
  ownerIds,
  memberById,
}: {
  ownerIds: string[];
  memberById: Map<string, Member>;
}) {
  if (ownerIds.length === 0) {
    return <Users className="h-3 w-3 text-muted-foreground" aria-hidden="true" />;
  }
  const first = memberById.get(ownerIds[0]);
  if (!first) return null;
  const initial = first.name.charAt(0).toUpperCase();
  return (
    <span
      className="h-5 w-5 rounded-full bg-accent/20 text-accent text-[10px] font-semibold flex items-center justify-center shrink-0"
      title={first.name}
      aria-label={`owner: ${first.name}`}
    >
      {initial}
    </span>
  );
}

// ── this-week strip ──────────────────────────────────────────────

function ThisWeekStrip({
  rows,
  onSelectMilestone,
}: {
  rows: Array<{
    milestone: Milestone;
    date: Date;
    days: number;
    project: Project | undefined;
  }>;
  onSelectMilestone: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 px-5 text-sm text-muted-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          nothing due in the next 7 days.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="text-sm font-medium">this week</span>
          <Badge variant="secondary" className="ml-auto">
            {rows.length}
          </Badge>
        </div>
        <ul className="divide-y divide-border">
          {rows.map(({ milestone, date, days, project }) => {
            const overdue = days < 0;
            const today = days === 0;
            return (
              <li
                key={milestone.id}
                className="px-5 py-2.5 flex items-center gap-3 text-sm hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => onSelectMilestone(milestone.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectMilestone(milestone.id);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <Diamond
                  className={cn(
                    "h-3 w-3",
                    fillClassFor(milestone.milestoneStatus),
                  )}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">{milestone.milestone}</span>
                {project && (
                  <span className="text-xs text-muted-foreground truncate">· {project.project}</span>
                )}
                <span
                  className={cn(
                    "ml-auto text-xs whitespace-nowrap",
                    overdue ? "text-destructive font-medium" : today ? "text-accent font-medium" : "text-muted-foreground",
                  )}
                >
                  {formatRelative(days)}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatShortDate(date)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── legend ───────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Diamond className="h-3 w-3 fill-muted-foreground text-muted-foreground" aria-hidden="true" />
        not started
      </div>
      <div className="flex items-center gap-1.5">
        <Diamond className="h-3 w-3 fill-[var(--chart-3)] text-[var(--chart-3)]" aria-hidden="true" />
        in progress
      </div>
      <div className="flex items-center gap-1.5">
        <Diamond className="h-3 w-3 fill-emerald-500 text-emerald-500" aria-hidden="true" />
        complete
      </div>
      <div className="flex items-center gap-1.5">
        <Diamond className="h-3 w-3 fill-destructive text-destructive" aria-hidden="true" />
        blocked
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="h-2 w-2 rounded-full bg-accent border border-background" aria-hidden="true" />
        help wanted
      </div>
    </div>
  );
}

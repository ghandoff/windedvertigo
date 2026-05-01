import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
  Ban,
  Calendar,
  User,
} from "lucide-react";
import type { Member } from "@/lib/notion/members";
import { CAPACITY_HOURS, type MemberCapacity } from "@/lib/notion/members";
import type { Timesheet } from "@/lib/notion/types";
import type { WorkItem } from "@/lib/notion/types";

// ── Types ──────────────────────────────────────────────

export interface MemberPulse {
  member: Member;
  notionUserId: string;
  /** Hours logged this week. */
  hoursThisWeek: number;
  /** Hours logged last week (for trend). */
  hoursLastWeek: number;
  /** Expected weekly hours based on capacity tier. */
  expectedHours: number;
  /** Utilization ratio (hoursThisWeek / expectedHours). */
  utilization: number;
  /** Open (non-complete, non-cancelled) task count. */
  openTasks: number;
  /** Urgent + high priority open tasks. */
  pressureTasks: number;
  /** Tasks due within the next 7 days. */
  upcomingDeadlines: number;
  /** Number of tasks this person is blocking others on. */
  blockingCount: number;
  /** Number of distinct projects they have active tasks in. */
  projectSpread: number;
  /** Overall load signal: "light" | "balanced" | "heavy" | "overloaded" */
  signal: "light" | "balanced" | "heavy" | "overloaded";
}

// ── Pulse calculation ──────────────────────────────────

export function computePulse(
  members: Member[],
  notionUserMap: Map<string, string>,
  timesheets: Timesheet[],
  workItems: WorkItem[],
): MemberPulse[] {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Week boundaries (Monday start)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const thisMondayStr = thisMonday.toISOString().split("T")[0];
  const lastMondayStr = lastMonday.toISOString().split("T")[0];

  const activeStatuses = new Set([
    "icebox",
    "in queue",
    "in progress",
    "suspended",
    "internal review",
    "needs documentation",
    "client review",
  ]);

  // Pre-index: which work item IDs are blocked by each person's tasks
  const allBlockingTargets = new Set<string>();
  for (const wi of workItems) {
    for (const bid of wi.blockingIds) allBlockingTargets.add(bid);
  }

  return members
    .filter((m) => m.active && m.capacity !== "former employee")
    .map((m) => {
      const userId = notionUserMap.get(m.email.toLowerCase());
      if (!userId) {
        return null;
      }

      // Time entries for this person
      const myTimesheets = timesheets.filter((ts) =>
        ts.personIds.includes(userId) && ts.type === "time",
      );

      const hoursThisWeek = myTimesheets
        .filter((ts) => ts.dateAndTime?.start && ts.dateAndTime.start >= thisMondayStr)
        .reduce((s, ts) => s + (ts.hours ?? 0), 0);

      const hoursLastWeek = myTimesheets
        .filter(
          (ts) =>
            ts.dateAndTime?.start &&
            ts.dateAndTime.start >= lastMondayStr &&
            ts.dateAndTime.start < thisMondayStr,
        )
        .reduce((s, ts) => s + (ts.hours ?? 0), 0);

      // Work items assigned to this person (via ownerIds or personIds)
      const myItems = workItems.filter(
        (wi) => wi.ownerIds.includes(userId) || wi.personIds.includes(userId),
      );

      const openItems = myItems.filter((wi) => activeStatuses.has(wi.status));
      const pressureTasks = openItems.filter(
        (wi) => wi.priority === "urgent" || wi.priority === "high",
      );
      const upcomingDeadlines = openItems.filter(
        (wi) => wi.dueDate?.start && wi.dueDate.start >= today && wi.dueDate.start <= nextWeekStr,
      );

      // How many of this person's open items are blocking someone else
      const blockingCount = openItems.filter((wi) => wi.blockingIds.length > 0).length;

      // Distinct projects
      const projectIds = new Set(openItems.flatMap((wi) => wi.projectIds));

      const expectedHours = CAPACITY_HOURS[m.capacity ?? "as needed"] ?? 10;
      const utilization = expectedHours > 0 ? hoursThisWeek / expectedHours : 0;

      // Signal calculation — weighted composite
      const signal = computeSignal(utilization, openItems.length, pressureTasks.length, upcomingDeadlines.length, blockingCount, expectedHours);

      return {
        member: m,
        notionUserId: userId,
        hoursThisWeek,
        hoursLastWeek,
        expectedHours,
        utilization,
        openTasks: openItems.length,
        pressureTasks: pressureTasks.length,
        upcomingDeadlines: upcomingDeadlines.length,
        blockingCount,
        projectSpread: projectIds.size,
        signal,
      } satisfies MemberPulse;
    })
    .filter((p): p is MemberPulse => p !== null)
    .sort((a, b) => signalRank(b.signal) - signalRank(a.signal)); // most overloaded first
}

function computeSignal(
  utilization: number,
  openTasks: number,
  pressureTasks: number,
  upcomingDeadlines: number,
  blockingCount: number,
  expectedHours: number,
): MemberPulse["signal"] {
  // Scale task thresholds relative to capacity
  // Someone at 6 hrs/wk with 4 open tasks is different from full-time with 4
  const taskDensity = expectedHours > 0 ? openTasks / (expectedHours / 8) : openTasks; // tasks per expected day

  let score = 0;

  // Utilization scoring (0-4 points)
  if (utilization >= 1.2) score += 4;
  else if (utilization >= 0.9) score += 2;
  else if (utilization >= 0.5) score += 1;

  // Task density scoring (0-3 points)
  if (taskDensity >= 4) score += 3;
  else if (taskDensity >= 2.5) score += 2;
  else if (taskDensity >= 1.5) score += 1;

  // Pressure (0-2 points)
  if (pressureTasks >= 3) score += 2;
  else if (pressureTasks >= 1) score += 1;

  // Deadline pressure (0-2 points)
  if (upcomingDeadlines >= 3) score += 2;
  else if (upcomingDeadlines >= 1) score += 1;

  // Blocking others (0-1 point) — social pressure
  if (blockingCount >= 1) score += 1;

  if (score >= 8) return "overloaded";
  if (score >= 5) return "heavy";
  if (score >= 2) return "balanced";
  return "light";
}

function signalRank(signal: MemberPulse["signal"]): number {
  return { light: 0, balanced: 1, heavy: 2, overloaded: 3 }[signal];
}

// ── Component ──────────────────────────────────────────

const SIGNAL_STYLES: Record<MemberPulse["signal"], { bg: string; text: string; label: string }> = {
  light: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "has bandwidth" },
  balanced: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "balanced" },
  heavy: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", label: "heavy load" },
  overloaded: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "overloaded" },
};

function UtilizationBar({ utilization }: { utilization: number }) {
  const pct = Math.min(utilization * 100, 150);
  const displayPct = Math.min(pct, 100);
  const over = utilization > 1;

  return (
    <div className="w-full">
      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            over ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : pct >= 40 ? "bg-green-500" : "bg-blue-400",
          )}
          style={{ width: `${displayPct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
        {(utilization * 100).toFixed(0)}% of capacity
      </p>
    </div>
  );
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (diff > 0) return <ArrowUp className="h-3 w-3 text-yellow-600" />;
  return <ArrowDown className="h-3 w-3 text-blue-500" />;
}

export function CollectivePulse({ pulses }: { pulses: MemberPulse[] }) {
  if (pulses.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          collective pulse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pulses.map((p) => {
          const style = SIGNAL_STYLES[p.signal];
          const firstName = p.member.name.split(" ")[0].toLowerCase();
          const capacityLabel = p.member.capacity ?? "as needed";

          return (
            <Link
              key={p.member.id}
              href={`/work/time?member=${p.notionUserId}`}
              className="block"
            >
              <div
                className={cn(
                  "rounded-lg border p-3 transition-shadow hover:shadow-sm",
                  style.bg,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: name + signal */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-background border flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{firstName}</span>
                        <TrendArrow current={p.hoursThisWeek} previous={p.hoursLastWeek} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {p.member.companyRole} · {capacityLabel}
                      </p>
                    </div>
                  </div>

                  {/* Right: signal badge */}
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", style.bg, style.text)}>
                    {style.label}
                  </Badge>
                </div>

                {/* Utilization bar */}
                <div className="mt-2">
                  <UtilizationBar utilization={p.utilization} />
                </div>

                {/* Metrics row */}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{p.hoursThisWeek.toFixed(1)}h this week</span>
                  <span>·</span>
                  <span className="tabular-nums">{p.openTasks} tasks</span>
                  {p.pressureTasks > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-yellow-700 font-medium">{p.pressureTasks} urgent</span>
                    </>
                  )}
                  {p.upcomingDeadlines > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" />
                        {p.upcomingDeadlines} due soon
                      </span>
                    </>
                  )}
                  {p.blockingCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-600 font-medium flex items-center gap-0.5">
                        <Ban className="h-3 w-3" />
                        blocking {p.blockingCount}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

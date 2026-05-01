"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Cycle, Milestone, WorkItem, Project } from "@/lib/notion/types";
import {
  computeViewport,
  dateToPercent,
  buildWeekHeaders,
  groupItemsByProject,
} from "@/lib/timeline-utils";

// ── status colors ────────────────────────────────────────

const CYCLE_STATUS_BG: Record<string, string> = {
  active: "bg-blue-200/60",
  planned: "bg-amber-200/50",
  complete: "bg-green-200/40",
};

const MILESTONE_STATUS_BG: Record<string, string> = {
  "not started": "text-muted-foreground",
  "in progress": "text-amber-600",
  complete: "text-green-600",
  blocked: "text-red-600",
};

const WORK_STATUS_BG: Record<string, string> = {
  "in progress": "bg-blue-500",
  "in queue": "bg-amber-500",
  "internal review": "bg-purple-500",
  "client review": "bg-pink-500",
  "needs documentation": "bg-indigo-500",
  complete: "bg-green-500",
  cancelled: "bg-gray-400",
  suspended: "bg-orange-400",
  icebox: "bg-gray-300",
};

// ── tooltip ──────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  content: React.ReactNode;
}

// ── component ────────────────────────────────────────────

interface TimelineViewProps {
  cycles: Cycle[];
  milestones: Milestone[];
  workItems: WorkItem[];
  projects: Project[];
}

export function TimelineView({
  cycles,
  milestones,
  workItems,
  projects,
}: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const viewport = useMemo(
    () => computeViewport(cycles, milestones, workItems),
    [cycles, milestones, workItems],
  );

  const weekHeaders = useMemo(
    () => buildWeekHeaders(viewport.start, viewport.totalDays),
    [viewport],
  );

  const workByProject = useMemo(
    () => groupItemsByProject(workItems),
    [workItems],
  );

  // Today line position
  const todayPct = dateToPercent(
    new Date().toISOString(),
    viewport.start,
    viewport.totalDays,
  );

  // Split scheduled vs unscheduled
  const scheduledCycles = cycles.filter((c) => c.startDate?.start);
  const unscheduledCycles = cycles.filter((c) => !c.startDate?.start);

  const scheduledMilestones = milestones.filter((m) => m.startDate ?? m.endDate);
  const unscheduledMilestones = milestones.filter((m) => !(m.startDate ?? m.endDate));

  const scheduledWork = workItems.filter((wi) => wi.dueDate?.start);
  const unscheduledWork = workItems.filter((wi) => !wi.dueDate?.start);

  function showTooltip(
    e: React.MouseEvent,
    content: React.ReactNode,
  ) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, content });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  // Format date helper
  function fmtDate(d: string | undefined | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const ROW_HEIGHT = "h-8";
  const LABEL_WIDTH = "w-[220px] min-w-[220px]";

  return (
    <div className="relative border rounded-lg bg-background overflow-hidden">
      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md bg-popover border shadow-md text-xs max-w-[260px]"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.content}
        </div>
      )}

      <div className="flex">
        {/* ── Left label column (sticky) ── */}
        <div
          className={`${LABEL_WIDTH} flex-shrink-0 border-r bg-muted/30 sticky left-0 z-10`}
        >
          {/* Header spacer */}
          <div className="h-8 border-b flex items-center px-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              timeline
            </span>
          </div>

          {/* Cycle labels */}
          {scheduledCycles.length > 0 && (
            <>
              <div className="h-6 flex items-center px-3 border-b bg-muted/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  cycles
                </span>
              </div>
              {scheduledCycles.map((c) => (
                <div
                  key={c.id}
                  className={`${ROW_HEIGHT} flex items-center px-3 border-b`}
                >
                  <span className="text-xs truncate">{c.cycle}</span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[9px] px-1 py-0"
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </>
          )}

          {/* Milestone labels */}
          {scheduledMilestones.length > 0 && (
            <>
              <div className="h-6 flex items-center px-3 border-b bg-muted/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  milestones
                </span>
              </div>
              {scheduledMilestones.map((m) => (
                <div
                  key={m.id}
                  className={`${ROW_HEIGHT} flex items-center px-3 border-b`}
                >
                  <span className="text-xs truncate">{m.milestone}</span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[9px] px-1 py-0"
                  >
                    {m.milestoneStatus}
                  </Badge>
                </div>
              ))}
            </>
          )}

          {/* Work item labels — grouped by project */}
          {scheduledWork.length > 0 && (
            <>
              <div className="h-6 flex items-center px-3 border-b bg-muted/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  work items
                </span>
              </div>
              {scheduledWork.map((wi) => {
                const proj = wi.projectIds[0]
                  ? projectMap.get(wi.projectIds[0])
                  : null;
                return (
                  <div
                    key={wi.id}
                    className={`${ROW_HEIGHT} flex items-center px-3 border-b`}
                  >
                    <span className="text-xs truncate flex-1">
                      {wi.task}
                    </span>
                    {proj && (
                      <span className="text-[9px] text-muted-foreground ml-1 truncate max-w-[60px]">
                        {proj.project}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Unscheduled section */}
          {(unscheduledCycles.length > 0 ||
            unscheduledMilestones.length > 0 ||
            unscheduledWork.length > 0) && (
            <>
              <div className="h-6 flex items-center px-3 border-b bg-muted/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  unscheduled
                </span>
              </div>
              {unscheduledCycles.map((c) => (
                <div
                  key={c.id}
                  className={`${ROW_HEIGHT} flex items-center px-3 border-b`}
                >
                  <span className="text-xs text-muted-foreground truncate">
                    {c.cycle}
                  </span>
                </div>
              ))}
              {unscheduledMilestones.map((m) => (
                <div
                  key={m.id}
                  className={`${ROW_HEIGHT} flex items-center px-3 border-b`}
                >
                  <span className="text-xs text-muted-foreground truncate">
                    {m.milestone}
                  </span>
                </div>
              ))}
              {unscheduledWork.map((wi) => (
                <div
                  key={wi.id}
                  className={`${ROW_HEIGHT} flex items-center px-3 border-b`}
                >
                  <span className="text-xs text-muted-foreground truncate">
                    {wi.task}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Right scrollable timeline area ── */}
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
          <div className="min-w-[800px] relative">
            {/* Week headers */}
            <div className="h-8 border-b relative">
              {weekHeaders.map((wh, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center"
                  style={{ left: `${wh.leftPct}%` }}
                >
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap pl-1">
                    {wh.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Today line */}
            {todayPct > 0 && todayPct < 100 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                style={{ left: `${todayPct}%` }}
              >
                <div className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded-b">
                  today
                </div>
              </div>
            )}

            {/* Week grid lines */}
            {weekHeaders.map((wh, i) => (
              <div
                key={i}
                className="absolute top-8 bottom-0 w-px bg-border/50 pointer-events-none"
                style={{ left: `${wh.leftPct}%` }}
              />
            ))}

            {/* ── Cycle rows ── */}
            {scheduledCycles.length > 0 && (
              <>
                {/* Section header spacer */}
                <div className="h-6 border-b" />
                {scheduledCycles.map((c) => {
                  const startPct = c.startDate?.start
                    ? dateToPercent(
                        c.startDate.start,
                        viewport.start,
                        viewport.totalDays,
                      )
                    : 0;
                  const endPct = c.endDate?.start
                    ? dateToPercent(
                        c.endDate.start,
                        viewport.start,
                        viewport.totalDays,
                      )
                    : startPct + 2;
                  const widthPct = Math.max(1, endPct - startPct);

                  return (
                    <div
                      key={c.id}
                      className={`${ROW_HEIGHT} border-b relative`}
                    >
                      <div
                        className={`absolute top-1 bottom-1 rounded ${CYCLE_STATUS_BG[c.status] ?? "bg-gray-200/50"} cursor-pointer`}
                        style={{
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                        }}
                        onMouseEnter={(e) =>
                          showTooltip(
                            e,
                            <div>
                              <p className="font-medium">{c.cycle}</p>
                              <p className="text-muted-foreground">
                                {fmtDate(c.startDate?.start)} –{" "}
                                {fmtDate(c.endDate?.start)}
                              </p>
                              {c.goal && (
                                <p className="mt-1 text-muted-foreground">
                                  {c.goal}
                                </p>
                              )}
                            </div>,
                          )
                        }
                        onMouseLeave={hideTooltip}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Milestone rows ── */}
            {scheduledMilestones.length > 0 && (
              <>
                <div className="h-6 border-b" />
                {scheduledMilestones.map((m) => {
                  const anchor = m.endDate ?? m.startDate!;
                  const pct = dateToPercent(
                    anchor,
                    viewport.start,
                    viewport.totalDays,
                  );

                  return (
                    <div
                      key={m.id}
                      className={`${ROW_HEIGHT} border-b relative`}
                    >
                      {/* Diamond pin */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                        style={{ left: `${pct}%` }}
                        onMouseEnter={(e) =>
                          showTooltip(
                            e,
                            <div>
                              <p className="font-medium">{m.milestone}</p>
                              <p className="text-muted-foreground">
                                {fmtDate(anchor)}
                              </p>
                              <p className="text-muted-foreground">
                                {m.kind} · {m.milestoneStatus}
                              </p>
                            </div>,
                          )
                        }
                        onMouseLeave={hideTooltip}
                      >
                        <div
                          className={`w-3 h-3 rotate-45 border-2 ${MILESTONE_STATUS_BG[m.milestoneStatus] ?? "text-muted-foreground"} border-current bg-background`}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Work item rows ── */}
            {scheduledWork.length > 0 && (
              <>
                <div className="h-6 border-b" />
                {scheduledWork.map((wi) => {
                  const startDate = wi.dueDate!.start;
                  const endDate = wi.dueDate!.end;
                  const startPct = dateToPercent(
                    startDate,
                    viewport.start,
                    viewport.totalDays,
                  );

                  // If there's an end date, draw a bar; otherwise a narrow pip
                  const hasRange = !!endDate;
                  const endPct = hasRange
                    ? dateToPercent(
                        endDate,
                        viewport.start,
                        viewport.totalDays,
                      )
                    : startPct;
                  const widthPct = hasRange
                    ? Math.max(0.5, endPct - startPct)
                    : 0;

                  return (
                    <div
                      key={wi.id}
                      className={`${ROW_HEIGHT} border-b relative`}
                    >
                      {hasRange ? (
                        <div
                          className={`absolute top-2.5 h-3 rounded-sm cursor-pointer ${WORK_STATUS_BG[wi.status] ?? "bg-blue-400"}`}
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                          }}
                          onMouseEnter={(e) =>
                            showTooltip(
                              e,
                              <div>
                                <p className="font-medium">{wi.task}</p>
                                <p className="text-muted-foreground">
                                  {fmtDate(startDate)} – {fmtDate(endDate)}
                                </p>
                                <p className="text-muted-foreground">
                                  {wi.status} · {wi.priority}
                                </p>
                              </div>,
                            )
                          }
                          onMouseLeave={hideTooltip}
                        />
                      ) : (
                        <div
                          className="absolute top-2.5 -translate-x-1/2 cursor-pointer"
                          style={{ left: `${startPct}%` }}
                          onMouseEnter={(e) =>
                            showTooltip(
                              e,
                              <div>
                                <p className="font-medium">{wi.task}</p>
                                <p className="text-muted-foreground">
                                  {fmtDate(startDate)}
                                </p>
                                <p className="text-muted-foreground">
                                  {wi.status} · {wi.priority}
                                </p>
                              </div>,
                            )
                          }
                          onMouseLeave={hideTooltip}
                        >
                          <div
                            className={`w-3 h-3 rounded-full ${WORK_STATUS_BG[wi.status] ?? "bg-blue-400"}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Unscheduled rows (empty grid area) ── */}
            {(unscheduledCycles.length > 0 ||
              unscheduledMilestones.length > 0 ||
              unscheduledWork.length > 0) && (
              <>
                <div className="h-6 border-b" />
                {[
                  ...unscheduledCycles,
                  ...unscheduledMilestones,
                  ...unscheduledWork,
                ].map((item) => (
                  <div
                    key={item.id}
                    className={`${ROW_HEIGHT} border-b relative`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/50">
                        no dates set
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {cycles.length === 0 &&
        milestones.length === 0 &&
        workItems.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">no items to display on the timeline</p>
            <p className="text-xs mt-1">
              create cycles, milestones, or work items with dates
            </p>
          </div>
        )}
    </div>
  );
}

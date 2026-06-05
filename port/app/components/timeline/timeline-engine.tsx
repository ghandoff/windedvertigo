"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { TimelineBar, TimelineLane, Zoom } from "./timeline-types";
import {
  buildScale,
  xForDate,
  daysFromPx,
  addDays,
  daysBetween,
  todayStr,
  monthSegments,
  weekTicks,
  type TimelineScale,
} from "./scale";
import { createTimelineAxisModifier } from "./timeline-axis-modifier";
import { DependencyArrows, type BarRect } from "./dependency-arrows";

const LANE_HEADER_H = 26;
const ROW_H = 30;
const BAR_H = 16;
const HEADER_H = 28;
const LABEL_COL_W = 180;

// ── per-bar interactive piece ────────────────────────────────

function InteractiveBar({
  bar,
  scale,
  onClick,
  onHover,
}: {
  bar: TimelineBar;
  scale: TimelineScale;
  onClick?: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const move = useDraggable({ id: `move:${bar.id}` });
  const startH = useDraggable({ id: `start:${bar.id}` });
  const endH = useDraggable({ id: `end:${bar.id}` });

  const x = xForDate(scale, bar.start!);
  const w = Math.max(scale.dayWidthPx, xForDate(scale, bar.end!) - x);

  // live preview offsets from whichever handle/body is being dragged
  const moveDx = move.transform?.x ?? 0;
  const startDx = startH.transform?.x ?? 0;
  const endDx = endH.transform?.x ?? 0;

  let left = x + moveDx + startDx;
  let width = w - startDx + endDx;
  if (width < scale.dayWidthPx) width = scale.dayWidthPx;

  const dragging = move.isDragging || startH.isDragging || endH.isDragging;

  return (
    <div
      className="absolute"
      style={{ left, top: (ROW_H - BAR_H) / 2, width, height: BAR_H }}
      onMouseEnter={() => onHover(bar.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* move body */}
      <button
        ref={move.setNodeRef}
        {...move.listeners}
        {...move.attributes}
        type="button"
        onClick={() => !dragging && onClick?.(bar.id)}
        className="group absolute inset-0 rounded-full transition-[filter] hover:brightness-105 cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: bar.color, opacity: dragging ? 0.7 : 1 }}
        title={`${bar.label} · ${formatDate(bar.start)} → ${formatDate(bar.end)}${bar.status ? ` · ${bar.status}` : ""}`}
      >
        <span className="sr-only">{bar.label}</span>
      </button>

      {/* resize handles — visible on hover */}
      <span
        ref={startH.setNodeRef}
        {...startH.listeners}
        {...startH.attributes}
        className="absolute left-0 top-0 h-full w-2 rounded-l-full cursor-ew-resize opacity-0 hover:opacity-100 bg-foreground/20"
      />
      <span
        ref={endH.setNodeRef}
        {...endH.listeners}
        {...endH.attributes}
        className="absolute right-0 top-0 h-full w-2 rounded-r-full cursor-ew-resize opacity-0 hover:opacity-100 bg-foreground/20"
      />

      {/* live date tooltip while dragging */}
      {dragging && (
        <span className="absolute -top-5 left-0 text-[10px] font-medium text-foreground bg-card border border-border rounded px-1 whitespace-nowrap">
          {formatDate(bar.start)} → {formatDate(bar.end)}
        </span>
      )}
    </div>
  );
}

function StaticBar({ bar, scale, onClick }: { bar: TimelineBar; scale: TimelineScale; onClick?: (id: string) => void }) {
  const x = xForDate(scale, bar.start!);
  const w = Math.max(scale.dayWidthPx, xForDate(scale, bar.end!) - x);
  return (
    <button
      type="button"
      onClick={() => onClick?.(bar.id)}
      className="absolute rounded-full transition-[filter] hover:brightness-105"
      style={{ left: x, top: (ROW_H - BAR_H) / 2, width: w, height: BAR_H, backgroundColor: bar.color }}
      title={`${bar.label} · ${formatDate(bar.start)} → ${formatDate(bar.end)}`}
    >
      <span className="sr-only">{bar.label}</span>
    </button>
  );
}

function Diamond({ bar, scale }: { bar: TimelineBar; scale: TimelineScale }) {
  // commitment with a due date but no start → point-in-time marker
  const x = xForDate(scale, bar.end!);
  return (
    <div
      className="absolute w-3 h-3 rotate-45 ring-1 ring-card"
      style={{ left: x - 6, top: (ROW_H - 12) / 2, backgroundColor: bar.color }}
      title={`${bar.label} · due ${formatDate(bar.end)}`}
    />
  );
}

// ── engine ───────────────────────────────────────────────────

export interface TimelineEngineProps {
  bars: TimelineBar[];
  lanes: TimelineLane[];
  zoom: Zoom;
  onZoomChange: (z: Zoom) => void;
  showDependencies?: boolean;
  onReschedule?: (id: string, start: string, end: string) => void;
  onResize?: (id: string, start: string, end: string) => void;
  onBarClick?: (id: string) => void;
}

export function TimelineEngine({
  bars,
  lanes,
  zoom,
  onZoomChange,
  showDependencies = false,
  onReschedule,
  onResize,
  onBarClick,
}: TimelineEngineProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [depsOn, setDepsOn] = useState(showDependencies);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // scale from every date in the data
  const scale = useMemo(() => {
    const dates: string[] = [];
    for (const b of bars) {
      if (b.start) dates.push(b.start);
      if (b.end) dates.push(b.end);
      for (const m of b.milestones ?? []) dates.push(m.date);
    }
    dates.push(todayStr());
    return buildScale(dates, zoom);
  }, [bars, zoom]);

  // group bars into lanes, splitting plotted vs unscheduled
  const { laneGroups, unscheduled } = useMemo(() => {
    const byLane = new Map<string, TimelineBar[]>();
    const un: TimelineBar[] = [];
    for (const b of bars) {
      if (!b.end) {
        un.push(b);
        continue;
      }
      if (!byLane.has(b.laneKey)) byLane.set(b.laneKey, []);
      byLane.get(b.laneKey)!.push(b);
    }
    for (const list of byLane.values()) {
      list.sort((a, z) => (a.start ?? a.end!).localeCompare(z.start ?? z.end!));
    }
    const groups = lanes
      .filter((l) => byLane.has(l.key))
      .map((l) => ({ lane: l, bars: byLane.get(l.key)! }));
    return { laneGroups: groups, unscheduled: un };
  }, [bars, lanes]);

  // compute y-positions + rects for dependency arrows
  const { rects, bodyHeight } = useMemo(() => {
    const r = new Map<string, BarRect>();
    let y = 0;
    for (const g of laneGroups) {
      y += LANE_HEADER_H;
      if (collapsed.has(g.lane.key)) continue;
      for (const b of g.bars) {
        if (b.start) {
          const x = xForDate(scale, b.start);
          const w = Math.max(scale.dayWidthPx, xForDate(scale, b.end!) - x);
          r.set(b.id, { x, w, y: y + (ROW_H - BAR_H) / 2, h: BAR_H });
        }
        y += ROW_H;
      }
    }
    return { rects: r, bodyHeight: y };
  }, [laneGroups, collapsed, scale]);

  const toggleLane = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const raw = String(event.active.id);
      const [kind, id] = raw.split(":");
      const bar = bars.find((b) => b.id === id);
      if (!bar || !bar.start || !bar.end) return;
      const days = daysFromPx(scale, event.delta.x);
      if (days === 0) return;

      if (kind === "move") {
        onReschedule?.(id, addDays(bar.start, days), addDays(bar.end, days));
      } else if (kind === "start") {
        const newStart = addDays(bar.start, days);
        if (daysBetween(newStart, bar.end) < 1) return; // keep at least 1 day
        onResize?.(id, newStart, bar.end);
      } else if (kind === "end") {
        const newEnd = addDays(bar.end, days);
        if (daysBetween(bar.start, newEnd) < 1) return;
        onResize?.(id, bar.start, newEnd);
      }
    },
    [bars, scale, onReschedule, onResize],
  );

  const months = useMemo(() => monthSegments(scale), [scale]);
  const ticks = useMemo(() => (zoom === "week" ? weekTicks(scale) : []), [scale, zoom]);
  const todayX = useMemo(() => xForDate(scale, todayStr()), [scale]);
  const interactive = Boolean(onReschedule || onResize);

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {(["week", "month", "quarter"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => onZoomChange(z)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                zoom === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={depsOn} onChange={(e) => setDepsOn(e.target.checked)} />
          show dependencies
        </label>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex">
          {/* ── left: sticky lane/label column ── */}
          <div className="shrink-0 border-r bg-card" style={{ width: LABEL_COL_W }}>
            <div style={{ height: HEADER_H }} className="border-b" />
            {laneGroups.map((g) => (
              <div key={g.lane.key}>
                <button
                  onClick={() => toggleLane(g.lane.key)}
                  className="flex items-center gap-1.5 w-full px-3 text-left hover:bg-muted/40"
                  style={{ height: LANE_HEADER_H }}
                >
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 transition-transform ${collapsed.has(g.lane.key) ? "-rotate-90" : ""}`}
                  />
                  <span className="text-xs font-medium capitalize truncate">{g.lane.label}</span>
                  <span className="text-[10px] text-muted-foreground">{g.bars.length}</span>
                </button>
                {!collapsed.has(g.lane.key) &&
                  g.bars.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center px-3 text-[11px] text-muted-foreground truncate"
                      style={{ height: ROW_H }}
                      title={b.label}
                    >
                      <span className="truncate">{b.label}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>

          {/* ── right: scrollable chart ── */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: scale.width }} className="relative">
              {/* time header */}
              <div className="relative border-b" style={{ height: HEADER_H }}>
                {months.map((m) => (
                  <div
                    key={m.key}
                    className="absolute top-0 h-full border-l border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 pt-1 whitespace-nowrap overflow-hidden"
                    style={{ left: m.leftPx, width: m.widthPx }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* body */}
              <DndContext
                sensors={sensors}
                modifiers={[createTimelineAxisModifier(scale.dayWidthPx)]}
                onDragStart={(e: DragStartEvent) => setHoveredId(String(e.active.id).split(":")[1])}
                onDragMove={(_e: DragMoveEvent) => {}}
                onDragEnd={handleDragEnd}
              >
                <div className="relative" style={{ height: bodyHeight }}>
                  {/* month gridlines */}
                  {months.slice(1).map((m) => (
                    <div
                      key={m.key}
                      className="absolute top-0 bottom-0 border-l border-border/40 pointer-events-none"
                      style={{ left: m.leftPx }}
                    />
                  ))}
                  {/* week ticks (week zoom only) */}
                  {ticks.map((t) => (
                    <div
                      key={t.key}
                      className="absolute top-0 bottom-0 border-l border-border/20 pointer-events-none"
                      style={{ left: t.leftPx }}
                    />
                  ))}

                  {/* today marker */}
                  {todayX >= 0 && todayX <= scale.width && (
                    <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: todayX }}>
                      <div className="h-full border-l-2 border-dashed border-[#b15043]" />
                    </div>
                  )}

                  {/* dependency arrows */}
                  <DependencyArrows
                    bars={bars}
                    rects={rects}
                    width={scale.width}
                    height={bodyHeight}
                    hoveredId={hoveredId}
                    showAll={depsOn}
                  />

                  {/* lane bands + bars */}
                  {(() => {
                    let y = 0;
                    const nodes: React.ReactNode[] = [];
                    for (const g of laneGroups) {
                      y += LANE_HEADER_H;
                      if (collapsed.has(g.lane.key)) continue;
                      for (const b of g.bars) {
                        const rowY = y;
                        nodes.push(
                          <div key={b.id} className="absolute left-0 right-0" style={{ top: rowY, height: ROW_H }}>
                            {!b.start ? (
                              <Diamond bar={b} scale={scale} />
                            ) : interactive && b.interactive !== false ? (
                              <InteractiveBar bar={b} scale={scale} onClick={onBarClick} onHover={setHoveredId} />
                            ) : (
                              <StaticBar bar={b} scale={scale} onClick={onBarClick} />
                            )}
                            {/* milestone diamonds on the row */}
                            {b.milestones?.map((m) => {
                              const mx = xForDate(scale, m.date);
                              return (
                                <div
                                  key={m.date + m.label}
                                  className="absolute w-2 h-2 rotate-45 bg-foreground/70 ring-1 ring-card pointer-events-none"
                                  style={{ left: mx - 4, top: (ROW_H - 8) / 2 }}
                                  title={`${m.label} · ${formatDate(m.date)}`}
                                />
                              );
                            })}
                          </div>,
                        );
                        y += ROW_H;
                      }
                    }
                    return nodes;
                  })()}
                </div>
              </DndContext>
            </div>
          </div>
        </div>
      </div>

      {/* unscheduled commitments (no due date) */}
      {unscheduled.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">unscheduled:</span>{" "}
          {unscheduled.map((b, i) => (
            <button
              key={b.id}
              onClick={() => onBarClick?.(b.id)}
              className="underline-offset-2 hover:underline"
            >
              {b.label}
              {i < unscheduled.length - 1 ? ", " : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

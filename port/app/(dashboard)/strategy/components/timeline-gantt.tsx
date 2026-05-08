"use client";

/**
 * timeline-gantt.tsx
 *
 * The signature visual of the /strategy page — a gantt-style roadmap
 * plotting all 6 campaigns across May–September 2026 with milestone
 * diamonds and a "today" marker.
 *
 * Layout: 2-column flex (labels left, bar grid right). All %-based
 * positioning lives inside the bar grid so the today marker, gridlines,
 * bars, and milestones all share the same coordinate space.
 *
 * Mobile: vertical stack with mini-bars at < md breakpoint.
 */

import { useMemo, useState } from "react";
import {
  CAMPAIGN_TIMELINES,
  TIMELINE_RANGE,
  type CampaignTimeline,
} from "@/lib/strategy-data";

const TIMELINE_START = new Date(TIMELINE_RANGE.start + "T00:00:00Z");
const TIMELINE_END = new Date(TIMELINE_RANGE.end + "T23:59:59Z");
const TOTAL_DAYS = TIMELINE_RANGE.totalDays;
const MS_PER_DAY = 86_400_000;

function dayToPercent(dateString: string): number {
  const date = new Date(dateString + "T00:00:00Z");
  const diff = (date.getTime() - TIMELINE_START.getTime()) / MS_PER_DAY;
  return Math.max(0, Math.min(100, (diff / TOTAL_DAYS) * 100));
}

function todayPercent(): number | null {
  const now = new Date();
  if (now < TIMELINE_START || now > TIMELINE_END) return null;
  const diff = (now.getTime() - TIMELINE_START.getTime()) / MS_PER_DAY;
  return (diff / TOTAL_DAYS) * 100;
}

const MONTH_BOUNDARIES = [
  { month: "may", start: 0, end: 31 },
  { month: "jun", start: 31, end: 61 },
  { month: "jul", start: 61, end: 92 },
  { month: "aug", start: 92, end: 123 },
  { month: "sep", start: 123, end: 153 },
];

function pctOf(days: number): number {
  return (days / TOTAL_DAYS) * 100;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const m = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${m.toLowerCase()} ${day}`;
}

export interface TimelineGanttProps {
  hideMilestones?: boolean;
}

export function TimelineGantt({ hideMilestones = false }: TimelineGanttProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const today = useMemo(() => todayPercent(), []);
  const todayLabel = useMemo(() => {
    const now = new Date();
    return now
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Los_Angeles",
      })
      .toLowerCase();
  }, []);

  const activeCampaign: CampaignTimeline | null =
    activeId !== null
      ? (CAMPAIGN_TIMELINES.find((c) => c.id === activeId) ?? null)
      : null;

  return (
    <div className="space-y-4">
      {/* ── desktop gantt (md+) ──────────────────────────── */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex gap-3">
            {/* LEFT: label column — header spacer + one button per row */}
            <div className="w-36 shrink-0 flex flex-col">
              {/* header spacer (matches month header height) */}
              <div className="h-5 mb-3" />
              {/* top padding to match the bar block's pt-3 */}
              <div className="pt-3 space-y-2">
                {CAMPAIGN_TIMELINES.map((c) => {
                  const isActive = activeId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setActiveId(isActive ? null : c.id)
                      }
                      className={`text-left text-xs leading-tight pr-2 truncate transition-colors h-6 flex items-center w-full ${
                        isActive
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={c.label}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: month headers + bar grid (single relative coord space) */}
            <div className="flex-1 min-w-0">
              {/* month header strip */}
              <div className="flex h-5 mb-3">
                {MONTH_BOUNDARIES.map((m) => {
                  const widthPct = pctOf(m.end - m.start);
                  return (
                    <div
                      key={m.month}
                      className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-l border-border first:border-l-0 px-2"
                      style={{ width: `${widthPct}%` }}
                    >
                      {m.month}
                    </div>
                  );
                })}
              </div>

              {/* bar block */}
              <div className="relative space-y-2 pt-3">
                {/* vertical month gridlines */}
                {MONTH_BOUNDARIES.slice(1).map((m) => (
                  <div
                    key={m.month}
                    className="absolute top-0 bottom-0 border-l border-border/50 pointer-events-none"
                    style={{ left: `${pctOf(m.start)}%` }}
                  />
                ))}

                {/* today vertical line + label */}
                {today !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-10 pointer-events-none"
                    style={{ left: `${today}%` }}
                  >
                    <div className="h-full border-l-2 border-dashed border-[#b15043]" />
                    <div
                      className="absolute -top-3 text-[10px] font-medium text-[#b15043] bg-card px-1 rounded whitespace-nowrap"
                      style={{
                        left:
                          today < 5
                            ? "0.25rem"
                            : today > 95
                              ? undefined
                              : "50%",
                        right: today > 95 ? "0.25rem" : undefined,
                        transform:
                          today >= 5 && today <= 95
                            ? "translateX(-50%)"
                            : undefined,
                      }}
                    >
                      today · {todayLabel}
                    </div>
                  </div>
                )}

                {/* one row per campaign */}
                {CAMPAIGN_TIMELINES.map((c) => {
                  const left = dayToPercent(c.start);
                  const width = Math.max(2, dayToPercent(c.end) - left);
                  const isActive = activeId === c.id;
                  return (
                    <div key={c.id} className="relative h-6">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveId(isActive ? null : c.id)
                        }
                        className={`absolute top-0 h-6 rounded-full transition-all hover:brightness-105 hover:shadow-sm ${
                          isActive ? "ring-2 ring-offset-1 ring-foreground/30" : ""
                        }`}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: c.colour,
                        }}
                        aria-label={`${c.label} · ${formatShortDate(c.start)} to ${formatShortDate(c.end)}`}
                      >
                        <span className="sr-only">{c.label}</span>
                      </button>

                      {!hideMilestones &&
                        c.milestones.map((m) => {
                          const mp = dayToPercent(m.date);
                          if (
                            mp < dayToPercent(c.start) - 0.5 ||
                            mp > dayToPercent(c.end) + 0.5
                          )
                            return null;
                          return (
                            <div
                              key={m.date + m.label}
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-foreground/80 ring-1 ring-card pointer-events-none"
                              style={{ left: `${mp}%` }}
                              title={`${m.label} · ${formatShortDate(m.date)}`}
                            />
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground italic mt-2 px-2">
          click a campaign to expand details · diamonds mark milestones · today marker in redwood
        </p>
      </div>

      {/* ── mobile stack (< md) ──────────────────────────── */}
      <div className="md:hidden space-y-3">
        <div className="text-[11px] text-muted-foreground px-1">
          may → sep · today: {todayLabel}
        </div>
        {CAMPAIGN_TIMELINES.map((c) => {
          const left = dayToPercent(c.start);
          const width = Math.max(4, dayToPercent(c.end) - left);
          const isActive = activeId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(isActive ? null : c.id)}
              className="w-full text-left rounded-lg border bg-card p-3 space-y-2 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{c.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatShortDate(c.start)} → {formatShortDate(c.end)}
                </span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: c.colour,
                  }}
                />
                {today !== null && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#b15043]"
                    style={{ left: `${today}%` }}
                  />
                )}
              </div>
              {isActive && (
                <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
                  {c.milestones.map((m) => (
                    <div
                      key={m.date + m.label}
                      className="flex items-baseline gap-2"
                    >
                      <span className="font-medium tabular-nums">
                        {formatShortDate(m.date)}
                      </span>
                      <span>— {m.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── active campaign detail (desktop only — mobile inlines) ── */}
      {activeCampaign && (
        <div
          className="hidden md:block rounded-lg border bg-muted/30 p-4 space-y-3"
          style={{ borderLeftColor: activeCampaign.colour, borderLeftWidth: 4 }}
        >
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold">{activeCampaign.label}</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatShortDate(activeCampaign.start)} → {formatShortDate(activeCampaign.end)}
            </span>
          </div>
          {activeCampaign.milestones.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                milestones
              </p>
              <ul className="space-y-1">
                {activeCampaign.milestones.map((m) => (
                  <li
                    key={m.date + m.label}
                    className="text-xs text-foreground flex items-baseline gap-2"
                  >
                    <span className="w-2 h-2 rotate-45 bg-foreground/80 inline-block shrink-0" />
                    <span className="font-medium tabular-nums">
                      {formatShortDate(m.date)}
                    </span>
                    <span className="text-muted-foreground">— {m.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

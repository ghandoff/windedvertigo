"use client";

/**
 * timeline-gantt.tsx
 *
 * The /strategy campaign roadmap. As of the PaM-Gantt work, the desktop view is
 * rendered by the shared <TimelineEngine> (one engine for both /strategy
 * campaigns and /pam commitments). The bespoke mobile stack is preserved for the
 * small-screen experience. Campaigns are read-only here (no drag) — the engine
 * renders static bars when no onReschedule/onResize handlers are passed.
 */

import { useMemo, useState } from "react";
import { TIMELINE_RANGE, type CampaignTimeline } from "@/lib/strategy-data";
import { TimelineEngine } from "@/app/components/timeline/timeline-engine";
import type { TimelineBar, TimelineLane, Zoom } from "@/app/components/timeline/timeline-types";

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

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const m = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${m.toLowerCase()} ${day}`;
}

const CAMPAIGN_LANE: TimelineLane[] = [{ key: "campaigns", label: "campaigns" }];

export interface TimelineGanttProps {
  /** Campaign timelines to render — fetched from Supabase by the page. */
  timelines: CampaignTimeline[];
  hideMilestones?: boolean;
}

export function TimelineGantt({ timelines, hideMilestones = false }: TimelineGanttProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>("month");

  const today = useMemo(() => todayPercent(), []);
  const todayLabel = useMemo(() => {
    const now = new Date();
    return now
      .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })
      .toLowerCase();
  }, []);

  // campaigns → generic timeline bars (single "campaigns" lane, read-only)
  const bars: TimelineBar[] = useMemo(
    () =>
      timelines.map((c) => ({
        id: c.id,
        laneKey: "campaigns",
        label: c.label,
        start: c.start,
        end: c.end,
        color: c.colour,
        milestones: hideMilestones ? undefined : c.milestones,
        interactive: false,
      })),
    [timelines, hideMilestones],
  );

  const activeCampaign: CampaignTimeline | null =
    activeId !== null ? (timelines.find((c) => c.id === activeId) ?? null) : null;

  return (
    <div className="space-y-4">
      {/* ── desktop: shared timeline engine ── */}
      <div className="hidden md:block">
        <TimelineEngine
          bars={bars}
          lanes={CAMPAIGN_LANE}
          zoom={zoom}
          onZoomChange={setZoom}
          onBarClick={(id) => setActiveId((cur) => (cur === id ? null : id))}
        />
        <p className="text-[11px] text-muted-foreground italic mt-2 px-2">
          click a campaign to expand details · diamonds mark milestones · today marker in redwood
        </p>
      </div>

      {/* ── mobile stack (< md) ── */}
      <div className="md:hidden space-y-3">
        <div className="text-[11px] text-muted-foreground px-1">
          may → sep · today: {todayLabel}
        </div>
        {timelines.map((c) => {
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
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: c.colour }}
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
                    <div key={m.date + m.label} className="flex items-baseline gap-2">
                      <span className="font-medium tabular-nums">{formatShortDate(m.date)}</span>
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">milestones</p>
              <ul className="space-y-1">
                {activeCampaign.milestones.map((m) => (
                  <li key={m.date + m.label} className="text-xs text-foreground flex items-baseline gap-2">
                    <span className="w-2 h-2 rotate-45 bg-foreground/80 inline-block shrink-0" />
                    <span className="font-medium tabular-nums">{formatShortDate(m.date)}</span>
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

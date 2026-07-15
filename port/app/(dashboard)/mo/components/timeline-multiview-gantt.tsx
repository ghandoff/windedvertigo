"use client";

/**
 * timeline-multiview-gantt.tsx
 *
 * The /mo timeline tab's multi-view Gantt — one item set (cmo_timeline_items),
 * four toggle-able groupings, per-lane show/hide. Reuses the existing shared
 * <TimelineEngine> (no new charting library) with `interactive` disabled —
 * this view is read-only in v1. See docs/prompts/strategy-brief-tab-port-build.md,
 * "timeline tab — multiple toggle-able Gantt views".
 *
 * Persistence: active view + hidden lanes (per view) are stored in
 * localStorage, hydrated after mount to avoid SSR mismatch — same pattern as
 * app/components/timer-context.tsx / docent-welcome-banner.tsx.
 */

import { useEffect, useMemo, useState } from "react";
import { TimelineEngine } from "@/app/components/timeline/timeline-engine";
import type { TimelineBar, TimelineLane, Zoom } from "@/app/components/timeline/timeline-types";
import { WV_COLOURS } from "@/lib/strategy-data";
import type { TimelineItem, TimelineItemKind } from "@/lib/supabase/cmo-timeline-items";
import { cn } from "@/lib/utils";

export interface TimelineMultiviewGanttProps {
  items: TimelineItem[];
}

type ViewKey = "workstream" | "owner" | "horizon" | "track";
type GroupField = "lane" | "owner" | "horizon" | "track";

interface ViewDef {
  key: ViewKey;
  label: string;
  field: GroupField;
  /** preferred group ordering; anything else sorts alphabetically after these */
  order?: string[];
}

const VIEWS: ViewDef[] = [
  { key: "workstream", label: "by workstream", field: "lane" },
  {
    key: "owner",
    label: "by owner",
    field: "owner",
    order: ["garrett", "maria", "payton", "jamie", "lamis"],
  },
  { key: "horizon", label: "by horizon", field: "horizon", order: ["now", "q3-2026", "2027"] },
  {
    key: "track",
    label: "mission vs survival",
    field: "track",
    order: ["mission", "survival", "neutral"],
  },
];

const KIND_COLOR: Record<TimelineItemKind, string> = {
  critical: WV_COLOURS.redwood,
  active: WV_COLOURS.teal,
  task: WV_COLOURS.periwinkle,
  milestone: WV_COLOURS.navy,
};

const KIND_LABEL: Record<TimelineItemKind, string> = {
  critical: "critical",
  active: "active",
  task: "planned",
  milestone: "milestone",
};

const UNASSIGNED = "unassigned";
const VIEW_STORAGE_KEY = "mo-timeline-view";
const HIDDEN_STORAGE_KEY = "mo-timeline-hidden-lanes";

function groupValue(item: TimelineItem, field: GroupField): string {
  const v = item[field];
  return v && v.trim() ? v : UNASSIGNED;
}

function sortGroups(keys: string[], order?: string[]): string[] {
  if (!order) {
    return [...keys].sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
  }
  const rank = new Map(order.map((k, i) => [k, i]));
  return [...keys].sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a)! : order.length + (a === UNASSIGNED ? 1 : 0);
    const rb = rank.has(b) ? rank.get(b)! : order.length + (b === UNASSIGNED ? 1 : 0);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

export function TimelineMultiviewGantt({ items }: TimelineMultiviewGanttProps) {
  const [viewKey, setViewKey] = useState<ViewKey>("workstream");
  const [hiddenByView, setHiddenByView] = useState<Record<string, string[]>>({});
  const [zoom, setZoom] = useState<Zoom>("month");
  const [hydrated, setHydrated] = useState(false);

  // hydrating from localStorage on mount — the pattern is intentional
  // (avoids SSR mismatch); see docent-welcome-banner.tsx / timer-context.tsx.
  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedView && VIEWS.some((v) => v.key === savedView)) setViewKey(savedView as ViewKey);
      const savedHidden = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
      if (savedHidden) setHiddenByView(JSON.parse(savedHidden));
    } catch {
      /* localStorage disabled — fine, falls back to defaults */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewKey);
    } catch {
      /* localStorage disabled — fine */
    }
  }, [viewKey, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenByView));
    } catch {
      /* localStorage disabled — fine */
    }
  }, [hiddenByView, hydrated]);

  const view = VIEWS.find((v) => v.key === viewKey) ?? VIEWS[0];
  const hiddenLanes = useMemo(() => new Set(hiddenByView[viewKey] ?? []), [hiddenByView, viewKey]);

  // regroup the same item set under the active view's field — no reload
  const { allLanes, visibleLanes, bars } = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) keys.add(groupValue(item, view.field));

    const orderedKeys = sortGroups(Array.from(keys), view.order);
    const lanes: TimelineLane[] = orderedKeys.map((k) => ({ key: k, label: k }));
    const visible = lanes.filter((l) => !hiddenLanes.has(l.key));

    const timelineBars: TimelineBar[] = items.map((item) => {
      const isMilestone = item.kind === "milestone";
      return {
        id: item.id,
        laneKey: groupValue(item, view.field),
        label: item.label,
        start: isMilestone ? null : item.start_date,
        end: item.end_date ?? item.start_date,
        color: KIND_COLOR[item.kind] ?? WV_COLOURS.periwinkle,
        status: KIND_LABEL[item.kind] ?? item.kind,
        interactive: false,
      };
    });

    return { allLanes: lanes, visibleLanes: visible, bars: timelineBars };
  }, [items, view, hiddenLanes]);

  const toggleLane = (key: string) => {
    setHiddenByView((prev) => {
      const current = new Set(prev[viewKey] ?? []);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [viewKey]: Array.from(current) };
    });
  };

  return (
    <div className="space-y-3">
      {/* view switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-border p-0.5 w-fit">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setViewKey(v.key)}
              className={cn(
                "px-2.5 py-1 rounded text-xs transition-colors",
                viewKey === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* per-lane show/hide chips for the current grouping */}
      {allLanes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allLanes.map((lane) => {
            const hidden = hiddenLanes.has(lane.key);
            return (
              <button
                key={lane.key}
                type="button"
                onClick={() => toggleLane(lane.key)}
                aria-pressed={!hidden}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize",
                  hidden
                    ? "border-border text-muted-foreground/50 bg-transparent line-through"
                    : "border-transparent bg-muted text-foreground hover:bg-muted/70",
                )}
              >
                {lane.key === UNASSIGNED ? "unassigned" : lane.key}
              </button>
            );
          })}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          no timeline items yet — Mo seeds these from whirlpool + strategy-log decisions via
          the agent API. the four views + lane toggles above are wired up and will populate
          as soon as items exist.
        </div>
      ) : visibleLanes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          all lanes hidden — click a chip above to show one.
        </div>
      ) : (
        <TimelineEngine bars={bars} lanes={visibleLanes} zoom={zoom} onZoomChange={setZoom} />
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
          <span className="font-medium">legend:</span>
          {(Object.keys(KIND_LABEL) as TimelineItemKind[]).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: KIND_COLOR[kind] }}
              />
              {KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

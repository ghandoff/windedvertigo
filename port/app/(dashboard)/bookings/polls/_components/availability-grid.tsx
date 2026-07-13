"use client";

import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { SuggestedSlot } from "@/lib/booking/collective-slots";

// ── helpers ──────────────────────────────────────────────────
function parseTimeMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "a" : "p";
  if (m === 0) return `${display}${ampm}`;
  return `${display}:${String(m).padStart(2, "0")}${ampm}`;
}

function fmtDateHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

/** Stable key for a slot — shared with the forms that submit `selected`. */
export function slotKey(s: string, e: string) { return `${s}|${e}`; }

/**
 * Doodle-style availability grid used by both poll create + edit.
 *
 * Selection is via Pointer Events so it works on mouse, touch, and pen:
 * tap toggles a cell; drag paints a run. `touch-action: pan-x` lets a
 * horizontal swipe still scroll the day columns, while a vertical drag
 * paints down a time column. The time-label column is sticky so the time
 * reference stays visible while scrolling wide (many-day) grids.
 */
export function AvailabilityGrid({
  suggestedSlots,
  selected,
  setSelected,
}: {
  suggestedSlots: SuggestedSlot[];
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
}) {
  const dragOpRef = useRef<"select" | "deselect" | null>(null);

  useEffect(() => {
    const end = () => { dragOpRef.current = null; };
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, []);

  const { dates, timeRows, cellMap } = useMemo(() => {
    if (suggestedSlots.length === 0) {
      return { dates: [] as string[], timeRows: [] as number[], cellMap: new Map<string, SuggestedSlot>() };
    }
    const byDate = new Map<string, SuggestedSlot[]>();
    for (const s of suggestedSlots) {
      const date = s.startsAt.split("T")[0];
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(s);
    }
    const dates = [...byDate.keys()].sort();
    const allStartMins = suggestedSlots.map((s) => parseTimeMins(s.startsAt.split("T")[1]));
    const allEndMins = suggestedSlots.map((s) => parseTimeMins(s.endsAt.split("T")[1]));
    const minMins = Math.min(...allStartMins);
    const maxMins = Math.max(...allEndMins);
    const timeRows: number[] = [];
    for (let m = minMins; m < maxMins; m += 30) timeRows.push(m);
    const cellMap = new Map<string, SuggestedSlot>();
    for (const s of suggestedSlots) {
      const date = s.startsAt.split("T")[0];
      const m = parseTimeMins(s.startsAt.split("T")[1]);
      cellMap.set(`${date}|${m}`, s);
    }
    return { dates, timeRows, cellMap };
  }, [suggestedSlots]);

  function paint(k: string, op: "select" | "deselect") {
    setSelected((prev) => {
      const next = new Set(prev);
      if (op === "select") next.add(k); else next.delete(k);
      return next;
    });
  }

  if (suggestedSlots.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Legend — flex-wrap so the two items stack instead of running off-screen on mobile */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary/60" />
          included in poll
        </span>
        <span className="flex items-center gap-1.5">
          {/* swatch matches the unselected cell fill (bg-muted/30) */}
          <span className="inline-block w-3 h-3 rounded-sm bg-muted/30 border border-border" />
          available (not included)
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `48px repeat(${dates.length}, minmax(58px, 1fr))`,
            gridTemplateRows: `32px repeat(${timeRows.length}, 24px)`,
            minWidth: `${48 + dates.length * 58}px`,
          }}
        >
          {/* Corner — sticky so it holds the top-left while scrolling */}
          <div
            style={{ gridRow: 1, gridColumn: 1, position: "sticky", left: 0, zIndex: 20 }}
            className="border-b border-r border-border bg-background"
          />

          {/* Day headers */}
          {dates.map((d, ci) => (
            <div
              key={d}
              style={{ gridRow: 1, gridColumn: ci + 2 }}
              className="border-b border-r border-border px-1 flex items-center justify-center text-[10px] text-muted-foreground font-medium truncate"
            >
              {fmtDateHeader(d)}
            </div>
          ))}

          {/* Time labels — sticky left so the time reference stays visible */}
          {timeRows.map((rowMins, ri) => (
            <div
              key={`lbl-${rowMins}`}
              style={{ gridRow: ri + 2, gridColumn: 1, position: "sticky", left: 0, zIndex: 10 }}
              className="border-r border-border bg-background flex items-center justify-end pr-1.5 text-[10px] text-muted-foreground"
            >
              {rowMins % 60 === 0 ? fmtMins(rowMins) : ""}
            </div>
          ))}

          {/* Cells — pointer events: tap toggles, drag paints (see component doc) */}
          {timeRows.map((rowMins, ri) =>
            dates.map((date, ci) => {
              const s = cellMap.get(`${date}|${rowMins}`);
              const isSel = s ? selected.has(slotKey(s.startsAt, s.endsAt)) : false;
              return (
                <div
                  key={`${date}-${rowMins}`}
                  style={{ gridRow: ri + 2, gridColumn: ci + 2, touchAction: s ? "pan-x" : undefined }}
                  onPointerDown={s ? (e) => {
                    e.preventDefault();
                    // Release implicit pointer capture so pointerenter fires on
                    // sibling cells during a touch drag (enables drag-paint on touch).
                    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
                    const k = slotKey(s.startsAt, s.endsAt);
                    const op = selected.has(k) ? "deselect" : "select";
                    dragOpRef.current = op;
                    paint(k, op);
                  } : undefined}
                  onPointerEnter={s ? () => {
                    if (dragOpRef.current !== null) {
                      paint(slotKey(s.startsAt, s.endsAt), dragOpRef.current);
                    }
                  } : undefined}
                  title={s ? `${s.label}${isSel ? " — deselect" : " — select"}` : undefined}
                  className={`border-r border-b border-border/40 transition-colors ${
                    s
                      ? isSel
                        ? "bg-primary/60 hover:bg-primary/50 cursor-pointer"
                        : "bg-muted/30 hover:bg-muted/50 cursor-pointer"
                      : ""
                  }`}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useMemo, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createPollAction } from "./actions";
import { SharePrompt } from "./share-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import type { SuggestedSlot } from "@/lib/booking/collective-slots";

interface ManualSlot { key: number; startsAt: string; endsAt: string; }

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "creating…" : "create poll"}
    </Button>
  );
}

interface Props {
  suggestedSlots?: SuggestedSlot[];
  initialFrom?: string;
  initialTo?: string;
}

function slotKey(s: string, e: string) { return `${s}|${e}`; }

function offsetDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

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

export function CreatePollForm({ suggestedSlots = [], initialFrom, initialTo }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState(createPollAction, null);

  const initialSelected = useMemo(
    () => new Set(suggestedSlots.map((s) => slotKey(s.startsAt, s.endsAt))),
    [suggestedSlots],
  );
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [manualSlots, setManualSlots] = useState<ManualSlot[]>([{ key: 0, startsAt: "", endsAt: "" }]);
  const [manualCounter, setManualCounter] = useState(1);
  // Lazy-init date range from URL params or compute sensible defaults from today.
  const [fromDate, setFromDate] = useState<string>(
    () => initialFrom ?? offsetDateStr(1),
  );
  const [toDate, setToDate] = useState<string>(
    () => initialTo ?? offsetDateStr(28),
  );
  // drag-select: null when not dragging, otherwise the operation to apply
  const dragOpRef = useRef<"select" | "deselect" | null>(null);

  useEffect(() => {
    const end = () => { dragOpRef.current = null; };
    document.addEventListener("mouseup", end);
    return () => document.removeEventListener("mouseup", end);
  }, []);

  const { dates, timeRows, cellMap } = useMemo(() => {
    if (suggestedSlots.length === 0) return { dates: [], timeRows: [] as number[], cellMap: new Map<string, SuggestedSlot>() };
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

  function toggleCell(s: SuggestedSlot) {
    const k = slotKey(s.startsAt, s.endsAt);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const selectedArr = [...selected].map((k) => {
    const [s, e] = k.split("|");
    return { startsAt: s, endsAt: e };
  });

  const useGrid = suggestedSlots.length > 0;

  if (state?.slug) {
    return (
      <SharePrompt
        shareUrl={state.shareUrl}
        slug={state.slug}
        pollId={state.pollId}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {useGrid &&
        selectedArr.map(({ startsAt, endsAt }) => (
          <span key={slotKey(startsAt, endsAt)}>
            <input type="hidden" name="starts_at" value={startsAt} />
            <input type="hidden" name="ends_at" value={endsAt} />
          </span>
        ))}

      <div className="space-y-2">
        <Label htmlFor="title">title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g. q3 strategy session"
          className="lowercase"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="what's this meeting for? any context helps."
          rows={2}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>candidate times</Label>
          {useGrid && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {selected.size} slot{selected.size !== 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelected(new Set(suggestedSlots.map((s) => slotKey(s.startsAt, s.endsAt))))
                }
                className="flex items-center gap-1 hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                reset to collective
              </button>
            </div>
          )}
        </div>

        {useGrid ? (
          <>
            {/* Date range picker — navigates to ?from=...&to=... so the server re-renders with new slots */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>date range</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value && toDate && toDate > e.target.value) {
                    router.push(`/bookings/polls/new?from=${e.target.value}&to=${toDate}`);
                  }
                }}
                className="h-7 text-xs w-36 px-2"
              />
              <span>–</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  if (fromDate && e.target.value && e.target.value > fromDate) {
                    router.push(`/bookings/polls/new?from=${fromDate}&to=${e.target.value}`);
                  }
                }}
                className="h-7 text-xs w-36 px-2"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              pre-filled from collective working hours — click or drag to select/deselect.
              each cell = 30 min.
            </p>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-primary/60" />
                included in poll
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-muted/50 border border-border" />
                available (not included)
              </span>
            </div>

            {/* Calendar grid — explicit grid positioning to avoid fragment issues */}
            <div className="overflow-x-auto rounded-md border">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `44px repeat(${dates.length}, minmax(58px, 1fr))`,
                  gridTemplateRows: `28px repeat(${timeRows.length}, 20px)`,
                  minWidth: `${44 + dates.length * 58}px`,
                }}
              >
                {/* Corner */}
                <div
                  style={{ gridRow: 1, gridColumn: 1 }}
                  className="border-b border-r border-border"
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

                {/* Time labels */}
                {timeRows.map((rowMins, ri) => (
                  <div
                    key={`lbl-${rowMins}`}
                    style={{ gridRow: ri + 2, gridColumn: 1 }}
                    className="border-r border-border flex items-center justify-end pr-1.5 text-[10px] text-muted-foreground"
                  >
                    {rowMins % 60 === 0 ? fmtMins(rowMins) : ""}
                  </div>
                ))}

                {/* Cells — drag-select: mousedown starts a select/deselect operation, mouseenter applies it */}
                {timeRows.map((rowMins, ri) =>
                  dates.map((date, ci) => {
                    const s = cellMap.get(`${date}|${rowMins}`);
                    const isSel = s ? selected.has(slotKey(s.startsAt, s.endsAt)) : false;
                    return (
                      <div
                        key={`${date}-${rowMins}`}
                        style={{ gridRow: ri + 2, gridColumn: ci + 2 }}
                        onMouseDown={s ? (e) => {
                          e.preventDefault();
                          const k = slotKey(s.startsAt, s.endsAt);
                          const op = selected.has(k) ? "deselect" : "select";
                          dragOpRef.current = op;
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (op === "select") next.add(k);
                            else next.delete(k);
                            return next;
                          });
                        } : undefined}
                        onMouseEnter={s ? () => {
                          if (dragOpRef.current !== null) {
                            const k = slotKey(s.startsAt, s.endsAt);
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (dragOpRef.current === "select") next.add(k);
                              else next.delete(k);
                              return next;
                            });
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
          </>
        ) : (
          /* Manual entry fallback when no suggested slots */
          <>
            {manualSlots.map((slot) => (
              <div key={slot.key} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    type="datetime-local"
                    name="starts_at"
                    required
                    value={slot.startsAt}
                    onChange={(e) =>
                      setManualSlots((p) =>
                        p.map((s) => (s.key === slot.key ? { ...s, startsAt: e.target.value } : s)),
                      )
                    }
                    className="text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="datetime-local"
                    name="ends_at"
                    required
                    value={slot.endsAt}
                    onChange={(e) =>
                      setManualSlots((p) =>
                        p.map((s) => (s.key === slot.key ? { ...s, endsAt: e.target.value } : s)),
                      )
                    }
                    className="text-sm"
                  />
                </div>
                {manualSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setManualSlots((p) => p.filter((s) => s.key !== slot.key))}
                    className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setManualSlots((p) => [...p, { key: manualCounter, startsAt: "", endsAt: "" }]);
                setManualCounter((c) => c + 1);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + add slot
            </button>
          </>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}

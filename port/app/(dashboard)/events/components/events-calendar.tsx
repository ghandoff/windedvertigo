/**
 * events-calendar.tsx — agenda + optional month-grid calendar for /events.
 *
 * Default mode: agenda — events grouped by month, scrollable.
 * Toggle: a CalendarDays icon swaps to a 7-col CSS grid month view (client-side
 * state only — no URL param — so switching modes doesn't cause a server round-trip).
 *
 * Events without a start date appear in a "date TBD" section at the bottom.
 *
 * Phase 13 + UX refresh: status-colored accents, date-range spans,
 * deadline chips, month-grid event chips colored by status.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, LayoutList, Pencil, Clock } from "lucide-react";
import { EventStatusBadge } from "../../campaigns/components/event-status-badge";
import { EventTriageBar } from "../../campaigns/components/event-triage-bar";
import type { CrmEvent, ConferenceStatus } from "@/lib/notion/types";

// ── status color tokens ────────────────────────────────────────────
// Left-border accent + chip background for the calendar grid.

const STATUS_ACCENT: Record<ConferenceStatus, string> = {
  candidate: "border-l-amber-400",
  watch:     "border-l-border",
  attend:    "border-l-emerald-400",
  pursue:    "border-l-emerald-500",
  not_relevant: "border-l-border",
};

const STATUS_CHIP_BG: Record<ConferenceStatus, string> = {
  candidate:    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  watch:        "bg-muted text-muted-foreground",
  attend:       "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  pursue:       "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200",
  not_relevant: "bg-muted/50 text-muted-foreground/50 line-through",
};

const STATUS_ROW_BG: Record<ConferenceStatus, string> = {
  candidate:    "bg-amber-50/40 dark:bg-amber-950/20",
  watch:        "bg-card/40",
  attend:       "bg-emerald-50/30 dark:bg-emerald-950/15",
  pursue:       "bg-emerald-50/50 dark:bg-emerald-950/25",
  not_relevant: "bg-muted/20",
};

// ── helpers ────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric" });
}

function dateRangeLabel(evt: CrmEvent): string {
  const start = evt.eventDates?.start;
  const end   = evt.eventDates?.end;
  if (!start) return "";
  if (!end || end === start) return fmtDate(start);
  // If same month, show "Jun 10–14"; if different months, show "Jun 30 – Jul 2"
  const sDate = new Date(start);
  const eDate = new Date(end);
  if (sDate.getMonth() === eDate.getMonth() && sDate.getFullYear() === eDate.getFullYear()) {
    return `${fmtDate(start)} – ${eDate.getDate()}`;
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function daysUntilDeadline(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupByMonth(events: CrmEvent[]) {
  const map = new Map<string, CrmEvent[]>();
  const tbd: CrmEvent[] = [];
  for (const evt of events) {
    const start = evt.eventDates?.start;
    if (!start) { tbd.push(evt); continue; }
    const key = monthKey(start);
    map.set(key, [...(map.get(key) ?? []), evt]);
  }
  const months = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, evts]) => ({ key, label: monthLabel(key), events: evts }));
  return { months, tbd };
}

// ── Deadline chip ──────────────────────────────────────────────────

function DeadlineChip({ deadline }: { deadline: string }) {
  const days = daysUntilDeadline(deadline);
  if (days === null) return null;

  const isPast = days < 0;
  const isUrgent = days >= 0 && days <= 7;
  const isNear = days > 7 && days <= 30;

  const cls = isPast
    ? "bg-muted text-muted-foreground/60 line-through"
    : isUrgent
    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    : isNear
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
    : "bg-muted text-muted-foreground";

  const label = isPast
    ? `cfp closed`
    : days === 0 ? "cfp today"
    : `cfp in ${days}d`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${cls}`}>
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

// ── Agenda row ─────────────────────────────────────────────────────

function AgendaRow({ evt }: { evt: CrmEvent }) {
  const accentBorder = STATUS_ACCENT[evt.status] ?? STATUS_ACCENT.watch;
  const rowBg       = STATUS_ROW_BG[evt.status] ?? STATUS_ROW_BG.watch;
  const dateRange   = dateRangeLabel(evt);

  return (
    <div
      className={`flex items-stretch gap-0 rounded-lg border border-border/60 overflow-hidden hover:border-border transition-all ${rowBg}`}
    >
      {/* Left status accent bar */}
      <div className={`w-1 shrink-0 border-l-4 rounded-l-lg ${accentBorder}`} />

      {/* Date column */}
      <div className="shrink-0 w-20 flex flex-col items-center justify-center px-2 py-3 border-r border-border/40">
        {dateRange ? (
          <span className="text-xs font-medium text-center leading-snug text-foreground/70">
            {dateRange}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">TBD</span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 px-3 py-2.5 space-y-1.5">
        {/* Top row: name + badges */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{evt.event}</p>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <EventStatusBadge status={evt.status} />
            <Link
              href={`/events/${evt.id}/edit`}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              title="Edit event"
            >
              <Pencil className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Meta row: type · location · deadline chip */}
        <div className="flex items-center gap-2 flex-wrap">
          {(evt.type || evt.location) && (
            <span className="text-xs text-muted-foreground">
              {[evt.type, evt.location].filter(Boolean).join(" · ")}
            </span>
          )}
          {evt.proposalDeadline?.start && (
            <DeadlineChip deadline={evt.proposalDeadline.start} />
          )}
          {evt.frequency && evt.frequency !== "One-off" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {evt.frequency.toLowerCase()}
            </span>
          )}
        </div>

        {/* Triage bar */}
        <EventTriageBar
          eventId={evt.id}
          eventName={evt.event}
          currentStatus={evt.status}
        />
      </div>
    </div>
  );
}

// ── Month header ───────────────────────────────────────────────────

function MonthHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h3 className="text-sm font-bold text-foreground">{label}</h3>
      <span className="text-xs text-muted-foreground">{count} event{count !== 1 ? "s" : ""}</span>
      <div className="flex-1 h-px bg-border/60 mt-1" />
    </div>
  );
}

// ── Month grid ─────────────────────────────────────────────────────

function MonthGrid({ events, monthsToShow = 3 }: { events: CrmEvent[]; monthsToShow?: number }) {
  const today = new Date();
  const months = Array.from({ length: monthsToShow }).map((_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const DOW_LABELS = ["su", "mo", "tu", "we", "th", "fr", "sa"];

  return (
    <div className="space-y-8">
      {months.map(({ year, month }) => {
        const label = new Date(year, month, 1).toLocaleDateString("en-US", {
          month: "long", year: "numeric",
        });
        const firstDow    = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const byDay = new Map<number, CrmEvent[]>();
        for (const evt of events) {
          const start = evt.eventDates?.start;
          if (!start) continue;
          const d = new Date(start);
          if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            byDay.set(day, [...(byDay.get(day) ?? []), evt]);
          }
          // Also show multi-day events on each day they span
          const end = evt.eventDates?.end;
          if (end && end !== start) {
            const eDate = new Date(end);
            let cur = new Date(start);
            cur.setDate(cur.getDate() + 1); // start was already added above
            while (cur <= eDate) {
              if (cur.getFullYear() === year && cur.getMonth() === month) {
                const day = cur.getDate();
                const existing = byDay.get(day) ?? [];
                if (!existing.some((e) => e.id === evt.id)) {
                  byDay.set(day, [...existing, evt]);
                }
              }
              cur.setDate(cur.getDate() + 1);
            }
          }
        }

        const eventsThisMonth = Array.from(byDay.values()).flat();
        const uniqueIds = new Set(eventsThisMonth.map(e => e.id));

        return (
          <div key={`${year}-${month}`}>
            <MonthHeader label={label} count={uniqueIds.size} />

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {DOW_LABELS.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[10px] font-medium py-1 ${
                    i === 0 || i === 6 ? "text-muted-foreground/50" : "text-muted-foreground"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-px bg-border/40 rounded-lg overflow-hidden border border-border/40">
              {/* Leading empty cells */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`pre-${i}`} className="bg-muted/20 min-h-[4rem]" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day       = i + 1;
                const dow       = (firstDow + i) % 7;
                const isWeekend = dow === 0 || dow === 6;
                const isToday   =
                  today.getFullYear() === year &&
                  today.getMonth() === month &&
                  today.getDate() === day;
                const dayEvts = byDay.get(day) ?? [];

                return (
                  <div
                    key={day}
                    className={`min-h-[4rem] p-1 flex flex-col gap-0.5 ${
                      isWeekend ? "bg-muted/30" : "bg-background"
                    } ${isToday ? "ring-2 ring-inset ring-primary/50" : ""}`}
                  >
                    {/* Day number */}
                    <span
                      className={`text-[11px] self-end leading-none px-1 py-0.5 rounded-full mb-0.5 ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : isWeekend
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>

                    {/* Event chips */}
                    {dayEvts.slice(0, 3).map((evt) => (
                      <Link
                        key={evt.id}
                        href={`/events/${evt.id}/edit`}
                        title={evt.event}
                        className={`block truncate text-[9px] font-medium leading-tight px-1 py-0.5 rounded transition-opacity hover:opacity-80 ${
                          STATUS_CHIP_BG[evt.status] ?? STATUS_CHIP_BG.watch
                        }`}
                      >
                        {evt.event}
                      </Link>
                    ))}
                    {dayEvts.length > 3 && (
                      <span className="text-[9px] text-muted-foreground px-1">
                        +{dayEvts.length - 3} more
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Trailing cells to complete the last row */}
              {(() => {
                const totalCells = firstDow + daysInMonth;
                const remainder  = totalCells % 7;
                const trailing   = remainder === 0 ? 0 : 7 - remainder;
                return Array.from({ length: trailing }).map((_, i) => (
                  <div key={`post-${i}`} className="bg-muted/20 min-h-[4rem]" />
                ));
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────

interface Props {
  events: CrmEvent[];
}

export function CalendarView({ events }: Props) {
  const [mode, setMode] = useState<"agenda" | "grid">("agenda");
  const { months, tbd } = groupByMonth(events);
  const today = new Date();
  const todayKey = monthKey(today.toISOString());

  // For agenda: split into "now or future" vs "past" months
  const futureMonths = months.filter((m) => m.key >= todayKey);
  const pastMonths   = months.filter((m) => m.key < todayKey);
  const [showPast, setShowPast] = useState(false);

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {mode === "agenda"
            ? `${futureMonths.reduce((n, m) => n + m.events.length, 0) + tbd.length} upcoming · ${
                pastMonths.reduce((n, m) => n + m.events.length, 0)
              } past`
            : `${events.length} events`}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setMode("agenda")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
              mode === "agenda"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            agenda
          </button>
          <button
            onClick={() => setMode("grid")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
              mode === "grid"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            month
          </button>
        </div>
      </div>

      {mode === "grid" ? (
        <MonthGrid events={events} monthsToShow={3} />
      ) : (
        /* ── Agenda mode ── */
        <div className="space-y-10">
          {/* Past months (collapsed by default) */}
          {pastMonths.length > 0 && (
            <div>
              <button
                onClick={() => setShowPast((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1"
              >
                <span className={`transition-transform ${showPast ? "rotate-90" : ""} inline-block`}>▶</span>
                {showPast ? "hide" : "show"} {pastMonths.reduce((n, m) => n + m.events.length, 0)} past events
              </button>
              {showPast && (
                <div className="space-y-10 opacity-70">
                  {pastMonths.map((group) => (
                    <section key={group.key}>
                      <MonthHeader label={group.label} count={group.events.length} />
                      <div className="space-y-2">
                        {group.events.map((evt) => <AgendaRow key={evt.id} evt={evt} />)}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Future + current months */}
          {futureMonths.map((group) => (
            <section key={group.key}>
              <MonthHeader label={group.label} count={group.events.length} />
              <div className="space-y-2">
                {group.events.map((evt) => <AgendaRow key={evt.id} evt={evt} />)}
              </div>
            </section>
          ))}

          {/* Date TBD */}
          {tbd.length > 0 && (
            <section>
              <MonthHeader label="date TBD" count={tbd.length} />
              <div className="space-y-2">
                {tbd.map((evt) => <AgendaRow key={evt.id} evt={evt} />)}
              </div>
            </section>
          )}

          {months.length === 0 && tbd.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              no events match these filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

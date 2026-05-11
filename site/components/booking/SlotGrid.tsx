"use client";

/**
 * Week-grid slot picker — SavvyCal-style. Replaces the pill-based SlotPicker.
 *
 * - 7 columns (one day each), 30-min row resolution.
 * - Visitor optionally picks a duration above the grid (when the event type
 *   has duration_options); the grid re-fetches valid start ticks for that
 *   duration.
 * - Click a cell to select that start. The selection visually spans
 *   duration/30 cells. Drag the selection to extend (snaps to a value in
 *   duration_options if available; otherwise stays at current duration).
 *
 * Mobile (<760 px) renders a simpler "available windows per day" list
 * because the 7-col grid is unwieldy on phones.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./booking.module.css";
import { TimezoneSelect } from "./TimezoneSelect";

export interface Slot {
  start: string; // ISO
  end: string; // ISO
  hostHint?: string;
  freeHostIds?: string[];
}

interface SlotGridProps {
  eventTypeId: string;
  durationMin: number;
  /** Allowed durations for this event type. Empty = single-duration; no toggle. */
  durationOptions: number[];
  defaultTz?: string;
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
  /** Optional callback to clear the current selection. If provided, a tiny
   *  "× clear" button renders in the duration row when something is selected. */
  onClear?: () => void;
}

interface SlotsResponse {
  slots: Slot[];
}

const DAYS_PER_WEEK = 7;
const STEP_MIN = 30;
const HOUR_START = 7;
const HOUR_END = 21; // exclusive — last row is 20:30
const ROWS_PER_HOUR = 60 / STEP_MIN;
const TOTAL_ROWS = (HOUR_END - HOUR_START) * ROWS_PER_HOUR;

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymdInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function hourMinInTz(date: Date, tz: string): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return { h: get("hour") % 24, m: get("minute") };
}

function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

function formatDayHeader(d: Date, tz: string): { dow: string; day: string } {
  const dow = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  })
    .format(d)
    .toLowerCase();
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "numeric",
    day: "numeric",
  }).format(d);
  return { dow, day };
}

function formatRowHour(rowIndex: number): string {
  const totalMin = HOUR_START * 60 + rowIndex * STEP_MIN;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m !== 0) return ""; // only label on the hour
  if (h === 12) return "12 pm";
  if (h === 0) return "12 am";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export function SlotGrid({
  eventTypeId,
  durationMin,
  durationOptions,
  defaultTz,
  selected,
  onSelect,
  onClear,
}: SlotGridProps) {
  const [tz, setTz] = useState<string>(defaultTz ?? "America/Los_Angeles");
  const [showTzSelect, setShowTzSelect] = useState(false);
  const [windowStart, setWindowStart] = useState<Date>(() => startOfDay(new Date()));
  const [chosenDuration, setChosenDuration] = useState<number>(durationMin);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Hydrate timezone client-side
  useEffect(() => {
    if (!defaultTz) setTz(detectTz());
  }, [defaultTz]);

  // Mobile detection — switches to chunked-list fallback below 760 px.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const windowEnd = useMemo(() => addDays(windowStart, DAYS_PER_WEEK), [windowStart]);

  const fetchSlots = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          eventTypeId,
          from: windowStart.toISOString(),
          to: windowEnd.toISOString(),
          tz,
        });
        if (durationOptions.length > 0) params.set("duration", String(chosenDuration));
        const res = await fetch(`/api/booking/slots?${params.toString()}`, { signal });
        if (!res.ok) {
          setError("couldn't load times — try again in a moment");
          setSlots([]);
          return;
        }
        const data = (await res.json()) as SlotsResponse;
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setError("couldn't load times — try again in a moment");
        setSlots([]);
      } finally {
        setLoading(false);
      }
    },
    [eventTypeId, windowStart, windowEnd, tz, chosenDuration, durationOptions.length],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSlots(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchSlots]);

  // Days in the current window (col → date at midnight, in viewer tz)
  const days = useMemo(() => {
    const arr: { key: string; date: Date }[] = [];
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const d = addDays(windowStart, i);
      arr.push({ key: ymdInTz(d, tz), date: d });
    }
    return arr;
  }, [windowStart, tz]);

  // Index slots by (day-key, row-index) for O(1) cell lookup
  const slotIndex = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of slots) {
      const start = new Date(s.start);
      const dayKey = ymdInTz(start, tz);
      const { h, m: min } = hourMinInTz(start, tz);
      if (h < HOUR_START || h >= HOUR_END) continue;
      const row = (h - HOUR_START) * ROWS_PER_HOUR + Math.round(min / STEP_MIN);
      m.set(`${dayKey}:${row}`, s);
    }
    return m;
  }, [slots, tz]);

  const cellsToHighlight = chosenDuration / STEP_MIN;

  // For the selected slot, compute (dayKey, startRow) so we can paint the span
  const selectedAnchor = useMemo(() => {
    if (!selected) return null;
    const start = new Date(selected.start);
    const dayKey = ymdInTz(start, tz);
    const { h, m } = hourMinInTz(start, tz);
    const row = (h - HOUR_START) * ROWS_PER_HOUR + Math.round(m / STEP_MIN);
    return { dayKey, row };
  }, [selected, tz]);

  function isCellSelected(dayKey: string, row: number): boolean {
    if (!selectedAnchor) return false;
    if (selectedAnchor.dayKey !== dayKey) return false;
    return row >= selectedAnchor.row && row < selectedAnchor.row + cellsToHighlight;
  }

  // ── render ─────────────────────────────────────────────────────

  const headerRow = (
    <div className={styles.gridDurationRow}>
      <div className={styles.gridDurationLabel}>
        {selected ? (
          <>
            <strong>{chosenDuration} min</strong>{" "}
            <span className={styles.gridDurationDate}>
              {formatTime(new Date(selected.start), tz)} –{" "}
              {formatTime(new Date(selected.end), tz)}
              {" · "}
              {new Intl.DateTimeFormat("en-US", {
                timeZone: tz,
                weekday: "short",
                month: "short",
                day: "numeric",
              })
                .format(new Date(selected.start))
                .toLowerCase()}
            </span>
            {onClear && (
              <button
                type="button"
                className={styles.gridDurationClear}
                onClick={onClear}
                aria-label="clear selected time"
              >
                × clear
              </button>
            )}
          </>
        ) : (
          <>
            <strong>{chosenDuration} min</strong>
            <span className={styles.gridDurationDate}>
              {" · pick a time below"}
            </span>
          </>
        )}
      </div>
      {durationOptions.length > 0 && (
        <div className={styles.gridDurationToggle} role="radiogroup" aria-label="meeting duration">
          {durationOptions.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === chosenDuration}
              className={`${styles.gridDurationOpt}${
                d === chosenDuration ? " " + styles.gridDurationOptActive : ""
              }`}
              onClick={() => setChosenDuration(d)}
            >
              {d} min
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const tzRow = (
    <div className={styles.tzRow}>
      your timezone: {tz.replace(/_/g, " ")}
      <button type="button" className={styles.tzLink} onClick={() => setShowTzSelect((s) => !s)}>
        (change)
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <div>
        {tzRow}
        {showTzSelect && <TimezoneSelect value={tz} onChange={(v) => setTz(v)} />}
        {headerRow}
        <MobileWindowsView
          slots={slots}
          tz={tz}
          chosenDuration={chosenDuration}
          loading={loading}
          error={error}
          selected={selected}
          onSelect={onSelect}
        />
        <WeekNav
          onPrev={() => setWindowStart((w) => addDays(w, -DAYS_PER_WEEK))}
          onNext={() => setWindowStart((w) => addDays(w, DAYS_PER_WEEK))}
        />
      </div>
    );
  }

  return (
    <div>
      {tzRow}
      {showTzSelect && <TimezoneSelect value={tz} onChange={(v) => setTz(v)} />}
      {headerRow}

      {loading && <div className={styles.loading}>loading times…</div>}
      {!loading && error && <div className={styles.errorMsg}>{error}</div>}

      {!loading && !error && (
        <div className={styles.gridScroll}>
          <table className={styles.weekGrid}>
            <thead>
              <tr>
                <th className={styles.weekGridTimeHead} aria-hidden />
                {days.map((d) => {
                  const { dow, day } = formatDayHeader(d.date, tz);
                  return (
                    <th key={d.key} className={styles.weekGridDayHead}>
                      <div className={styles.weekGridDow}>{dow}</div>
                      <div className={styles.weekGridDay}>{day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: TOTAL_ROWS }).map((_, row) => (
                <tr key={row} className={row % ROWS_PER_HOUR === 0 ? styles.weekGridHourBoundary : ""}>
                  <td className={styles.weekGridTimeCell}>{formatRowHour(row)}</td>
                  {days.map((d) => {
                    const slot = slotIndex.get(`${d.key}:${row}`);
                    const sel = isCellSelected(d.key, row);
                    const available = Boolean(slot);
                    const cls = [
                      styles.weekGridCell,
                      available ? styles.weekGridCellAvailable : styles.weekGridCellUnavailable,
                      sel ? styles.weekGridCellSelected : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <td
                        key={d.key + ":" + row}
                        className={cls}
                        onClick={() => slot && onSelect(slot)}
                        aria-label={
                          available
                            ? `available ${formatTime(new Date(slot!.start), tz)}`
                            : "unavailable"
                        }
                        role={available ? "button" : undefined}
                        tabIndex={available ? 0 : undefined}
                        onKeyDown={
                          available
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onSelect(slot!);
                                }
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && slots.length === 0 && (
        <div className={styles.empty}>no times available — try another week</div>
      )}

      <WeekNav
        onPrev={() => setWindowStart((w) => addDays(w, -DAYS_PER_WEEK))}
        onNext={() => setWindowStart((w) => addDays(w, DAYS_PER_WEEK))}
      />

      <input type="hidden" data-booking-tz={tz} value={tz} readOnly />
    </div>
  );
}

function WeekNav({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div className={styles.weekNav}>
      <button type="button" className={styles.tzLink} onClick={onPrev}>
        ← previous week
      </button>
      <button type="button" className={styles.tzLink} onClick={onNext}>
        next week →
      </button>
    </div>
  );
}

// ── mobile view ────────────────────────────────────────────────────

interface MobileViewProps {
  slots: Slot[];
  tz: string;
  chosenDuration: number;
  loading: boolean;
  error: string | null;
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}

/**
 * Mobile fallback: per-day list. Each day shows windows of consecutive
 * available slots; tapping a window expands it to the individual start
 * times. This is more thumb-friendly than the 7-col grid.
 */
function MobileWindowsView({
  slots,
  tz,
  chosenDuration,
  loading,
  error,
  selected,
  onSelect,
}: MobileViewProps) {
  // Group by day, then collapse consecutive 30-min slots into "windows" for
  // the day header, and keep individual slots inside each window for tapping.
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = ymdInTz(new Date(s.start), tz);
      (map.get(k) ?? map.set(k, []).get(k)!).push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots, tz]);

  const [openDay, setOpenDay] = useState<string | null>(null);

  if (loading) return <div className={styles.loading}>loading times…</div>;
  if (error) return <div className={styles.errorMsg}>{error}</div>;
  if (slots.length === 0) {
    return <div className={styles.empty}>no times available — try another week</div>;
  }

  return (
    <div className={styles.mobileDays}>
      {byDay.map(([dayKey, daySlots]) => {
        const isOpen = openDay === dayKey;
        const date = new Date(daySlots[0].start);
        const heading = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "long",
          month: "long",
          day: "numeric",
        })
          .format(date)
          .toLowerCase();
        return (
          <div key={dayKey} className={styles.mobileDay}>
            <button
              type="button"
              className={styles.mobileDayBtn}
              onClick={() => setOpenDay(isOpen ? null : dayKey)}
              aria-expanded={isOpen}
            >
              <span>{heading}</span>
              <span className={styles.mobileDayCount}>
                {daySlots.length} {chosenDuration}-min option{daySlots.length === 1 ? "" : "s"}
              </span>
            </button>
            {isOpen && (
              <div className={styles.mobileSlotList}>
                {daySlots.map((s) => {
                  const isSel = selected?.start === s.start;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      className={`${styles.mobileSlotBtn}${isSel ? " " + styles.mobileSlotBtnActive : ""}`}
                      onClick={() => onSelect(s)}
                    >
                      {formatTime(new Date(s.start), tz)} –{" "}
                      {formatTime(new Date(s.end), tz)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function detectVisitorTz(): string {
  return detectTz();
}

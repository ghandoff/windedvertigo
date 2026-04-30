"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./booking.module.css";
import { DatePicker } from "./DatePicker";
import { TimezoneSelect } from "./TimezoneSelect";

export interface Slot {
  start: string; // ISO
  end: string;   // ISO
  hostHint?: string;
  freeHostIds?: string[];
}

interface SlotPickerProps {
  eventTypeId: string;
  durationMin: number;
  defaultTz?: string;
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
}

interface SlotsResponse {
  slots: Slot[];
}

const HORIZON_DAYS = 14;

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

function ymdInTz(date: Date, tz: string): string {
  // Returns YYYY-MM-DD as observed in the given timezone.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
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

function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .toLowerCase();
}

function formatDayHeader(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(d)
    .toLowerCase();
}

export function SlotPicker({ eventTypeId, durationMin, defaultTz, selected, onSelect }: SlotPickerProps) {
  const [tz, setTz] = useState<string>(defaultTz ?? "America/Los_Angeles");
  const [showTzSelect, setShowTzSelect] = useState(false);
  const [windowStart, setWindowStart] = useState<Date>(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Hydrate timezone client-side
  useEffect(() => {
    if (!defaultTz) setTz(detectTz());
  }, [defaultTz]);

  const windowEnd = useMemo(() => addDays(windowStart, HORIZON_DAYS), [windowStart]);

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
    [eventTypeId, windowStart, windowEnd, tz],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSlots(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchSlots]);

  // Group slots by day-in-tz
  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = ymdInTz(new Date(s.start), tz);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [slots, tz]);

  const availableDays = useMemo(() => new Set(slotsByDay.keys()), [slotsByDay]);

  // Determine which day's slots to show
  const daysToShow = useMemo(() => {
    if (selectedDay) {
      const k = ymdInTz(selectedDay, tz);
      const arr = slotsByDay.get(k);
      return arr ? [{ key: k, date: selectedDay, slots: arr }] : [];
    }
    // show all days that have slots, sorted
    const keys = Array.from(slotsByDay.keys()).sort();
    return keys.map((k) => {
      const slots = slotsByDay.get(k)!;
      return { key: k, date: new Date(slots[0].start), slots };
    });
  }, [selectedDay, slotsByDay, tz]);

  return (
    <div>
      <div className={styles.tzRow}>
        your timezone: {tz.replace(/_/g, " ")}
        <button type="button" className={styles.tzLink} onClick={() => setShowTzSelect((s) => !s)}>
          (change)
        </button>
      </div>

      {showTzSelect && <TimezoneSelect value={tz} onChange={(v) => setTz(v)} />}

      <DatePicker
        startDate={windowStart}
        endDate={addDays(windowStart, HORIZON_DAYS - 1)}
        selected={selectedDay}
        onChange={(d) => setSelectedDay(d)}
        available={availableDays}
      />

      {loading && <div className={styles.loading}>loading times…</div>}

      {!loading && error && <div className={styles.errorMsg}>{error}</div>}

      {!loading && !error && daysToShow.length === 0 && (
        <div className={styles.empty}>no times available — try another week</div>
      )}

      {!loading &&
        !error &&
        daysToShow.map((day) => (
          <div key={day.key} className={styles.slotGroup}>
            <div className={styles.slotGroupHeader}>{formatDayHeader(day.date, tz)}</div>
            <div className={styles.slotPills}>
              {day.slots.map((slot) => {
                const isSelected = selected?.start === slot.start;
                return (
                  <button
                    type="button"
                    key={slot.start}
                    className={`${styles.slotPill}${isSelected ? " " + styles.selected : ""}`}
                    onClick={() => onSelect(slot)}
                  >
                    {formatTime(slot.start, tz)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      <div className={styles.weekNav}>
        <button
          type="button"
          className={styles.tzLink}
          onClick={() => {
            setWindowStart((w) => addDays(w, -HORIZON_DAYS));
            setSelectedDay(null);
          }}
        >
          ← previous {HORIZON_DAYS} days
        </button>
        <button
          type="button"
          className={styles.tzLink}
          onClick={() => {
            setWindowStart((w) => addDays(w, HORIZON_DAYS));
            setSelectedDay(null);
          }}
        >
          next {HORIZON_DAYS} days →
        </button>
      </div>

      {/* expose current tz on a data attribute so parent can read it if needed */}
      <input type="hidden" data-booking-tz={tz} value={tz} readOnly />

      {/* duration hint for callers; satisfies isolatedModules' export of all references */}
      <span hidden aria-hidden>
        {durationMin}
      </span>
    </div>
  );
}

export function detectVisitorTz(): string {
  return detectTz();
}

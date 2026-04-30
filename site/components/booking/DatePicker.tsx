"use client";

import { useMemo, useState } from "react";
import styles from "./booking.module.css";

interface DatePickerProps {
  startDate: Date;
  endDate: Date;
  selected: Date | null;
  onChange: (d: Date) => void;
  available: Set<string>; // YYYY-MM-DD strings
}

const VISIBLE_DAYS = 7;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function DatePicker({ startDate, endDate, selected, onChange, available }: DatePickerProps) {
  const min = startOfDay(startDate);
  const max = startOfDay(endDate);
  const [windowStart, setWindowStart] = useState<Date>(() => startOfDay(selected ?? startDate));

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < VISIBLE_DAYS; i++) out.push(addDays(windowStart, i));
    return out;
  }, [windowStart]);

  const canPrev = windowStart > min;
  const canNext = addDays(windowStart, VISIBLE_DAYS) <= max;

  return (
    <div className={styles.dateStrip}>
      <button
        type="button"
        className={styles.arrowBtn}
        onClick={() => setWindowStart((w) => addDays(w, -VISIBLE_DAYS))}
        disabled={!canPrev}
        aria-label="previous days"
      >
        ←
      </button>
      <div className={styles.dateStripScroll}>
        {days.map((d) => {
          const key = ymd(d);
          const isAvail = available.has(key);
          const isSelected = selected && ymd(selected) === key;
          const outOfRange = d < min || d > max;
          const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
          return (
            <button
              type="button"
              key={key}
              className={[
                styles.dayBtn,
                isAvail ? styles.available : "",
                isSelected ? styles.selected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(d)}
              disabled={outOfRange}
              aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              aria-pressed={isSelected ? true : false}
            >
              <div className={styles.dayBtnDow}>{dow}</div>
              <div className={styles.dayBtnNum}>{d.getDate()}</div>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.arrowBtn}
        onClick={() => setWindowStart((w) => addDays(w, VISIBLE_DAYS))}
        disabled={!canNext}
        aria-label="next days"
      >
        →
      </button>
    </div>
  );
}

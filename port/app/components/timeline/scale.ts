// Timezone-safe date↔pixel math for the timeline engine.
// All dates are date-only "YYYY-MM-DD" strings parsed as LOCAL midnight via
// parseDateOnly — this keeps server (UTC) and browser (PT) consistent and
// avoids the classic new Date("2026-06-01") UTC-vs-local off-by-one.

import { parseDateOnly } from "@/lib/format";
import type { Zoom } from "./timeline-types";

const MS_PER_DAY = 86_400_000;

/** pixels per day at each zoom level */
const DAY_PX: Record<Zoom, number> = {
  week: 26,
  month: 9,
  quarter: 3.5,
};

export interface TimelineScale {
  startMs: number; // local-midnight ms of the (padded) viewport start
  startDate: string; // YYYY-MM-DD of viewport start
  totalDays: number;
  dayWidthPx: number;
  width: number; // totalDays * dayWidthPx
}

const SHORT_MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/** today as a local YYYY-MM-DD string */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** add n days to a YYYY-MM-DD string, returning a YYYY-MM-DD string */
export function addDays(dateStr: string, n: number): string {
  const d = parseDateOnly(dateStr);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** whole-day difference b − a (a, b are YYYY-MM-DD) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / MS_PER_DAY);
}

/**
 * Build a scale from the min/max dates present in the data, padded for breathing
 * room. Falls back to a window around today when there are no dates.
 */
export function buildScale(
  dates: string[],
  zoom: Zoom,
): TimelineScale {
  const dayWidthPx = DAY_PX[zoom];
  const padBefore = 3;
  const padAfter = zoom === "week" ? 10 : zoom === "month" ? 21 : 45;

  let minStr: string;
  let maxStr: string;
  if (dates.length === 0) {
    const t = todayStr();
    minStr = addDays(t, -7);
    maxStr = addDays(t, 21);
  } else {
    const sorted = [...dates].sort();
    minStr = sorted[0];
    maxStr = sorted[sorted.length - 1];
  }

  const startDate = addDays(minStr, -padBefore);
  const endDate = addDays(maxStr, padAfter);
  const totalDays = Math.max(1, daysBetween(startDate, endDate) + 1);

  return {
    startMs: parseDateOnly(startDate).getTime(),
    startDate,
    totalDays,
    dayWidthPx,
    width: totalDays * dayWidthPx,
  };
}

/** pixel x-offset for a date within the scale */
export function xForDate(scale: TimelineScale, dateStr: string): number {
  const offsetDays = (parseDateOnly(dateStr).getTime() - scale.startMs) / MS_PER_DAY;
  return offsetDays * scale.dayWidthPx;
}

/** convert a pixel delta to a rounded whole-day delta (for drag snapping) */
export function daysFromPx(scale: TimelineScale, px: number): number {
  return Math.round(px / scale.dayWidthPx);
}

export interface MonthSegment {
  key: string;
  label: string;
  leftPx: number;
  widthPx: number;
}

/** month bands spanning the viewport, for the time header + gridlines */
export function monthSegments(scale: TimelineScale): MonthSegment[] {
  const segments: MonthSegment[] = [];
  const start = parseDateOnly(scale.startDate);
  // first day of the start month
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMs = scale.startMs + scale.totalDays * MS_PER_DAY;

  while (cursor.getTime() < endMs) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const segStartMs = Math.max(cursor.getTime(), scale.startMs);
    const segEndMs = Math.min(next.getTime(), endMs);
    const leftPx = ((segStartMs - scale.startMs) / MS_PER_DAY) * scale.dayWidthPx;
    const widthPx = ((segEndMs - segStartMs) / MS_PER_DAY) * scale.dayWidthPx;
    segments.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: `${SHORT_MONTHS[cursor.getMonth()]}${cursor.getMonth() === 0 ? " " + cursor.getFullYear() : ""}`,
      leftPx,
      widthPx,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return segments;
}

/** Monday gridline x-offsets (only used at week zoom for finer ticks) */
export function weekTicks(scale: TimelineScale): { key: string; leftPx: number; label: string }[] {
  const ticks: { key: string; leftPx: number; label: string }[] = [];
  const cursor = parseDateOnly(scale.startDate);
  // advance to next Monday
  const dow = cursor.getDay();
  const untilMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  cursor.setDate(cursor.getDate() + untilMon);

  const endMs = scale.startMs + scale.totalDays * MS_PER_DAY;
  while (cursor.getTime() <= endMs) {
    const leftPx = ((cursor.getTime() - scale.startMs) / MS_PER_DAY) * scale.dayWidthPx;
    ticks.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
      leftPx,
      label: `${cursor.getDate()}`,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return ticks;
}

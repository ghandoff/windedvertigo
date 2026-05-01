/**
 * Pure utility functions for the Gantt/timeline view.
 */

import type { Cycle, Milestone, WorkItem } from "@/lib/notion/types";

// ── viewport ─────────────────────────────────────────────

export interface Viewport {
  start: Date;
  end: Date;
  totalDays: number;
}

/**
 * Compute the visible date range across all entities.
 * Pads 7 days on each side for breathing room.
 */
export function computeViewport(
  cycles: Cycle[],
  milestones: Milestone[],
  workItems: WorkItem[],
): Viewport {
  const dates: Date[] = [];

  for (const c of cycles) {
    if (c.startDate?.start) dates.push(new Date(c.startDate.start));
    if (c.endDate?.start) dates.push(new Date(c.endDate.start));
  }

  for (const m of milestones) {
    if (m.startDate) dates.push(new Date(m.startDate));
    if (m.endDate) dates.push(new Date(m.endDate));
  }

  for (const wi of workItems) {
    if (wi.dueDate?.start) dates.push(new Date(wi.dueDate.start));
    if (wi.dueDate?.end) dates.push(new Date(wi.dueDate.end));
  }

  if (dates.length === 0) {
    // fallback: center on today with a 30-day window
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 15);
    const end = new Date(now);
    end.setDate(end.getDate() + 15);
    return { start, end, totalDays: 30 };
  }

  const minMs = Math.min(...dates.map((d) => d.getTime()));
  const maxMs = Math.max(...dates.map((d) => d.getTime()));

  const start = new Date(minMs);
  start.setDate(start.getDate() - 7);
  const end = new Date(maxMs);
  end.setDate(end.getDate() + 7);

  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return { start, end, totalDays };
}

// ── positioning ──────────────────────────────────────────

/**
 * Convert a date string to a percentage position (0–100) within the viewport.
 */
export function dateToPercent(
  date: string,
  viewStart: Date,
  totalDays: number,
): number {
  const d = new Date(date);
  const dayOffset =
    (d.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24);
  const pct = (dayOffset / totalDays) * 100;
  return Math.max(0, Math.min(100, pct));
}

// ── week headers ─────────────────────────────────────────

export interface WeekHeader {
  label: string;
  leftPct: number;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Build column headers — one per week.
 */
export function buildWeekHeaders(
  viewStart: Date,
  totalDays: number,
): WeekHeader[] {
  const headers: WeekHeader[] = [];
  const cursor = new Date(viewStart);

  // Advance to the next Monday
  const dayOfWeek = cursor.getDay();
  const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  cursor.setDate(cursor.getDate() + daysUntilMon);

  while (true) {
    const dayOffset =
      (cursor.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24);
    const pct = (dayOffset / totalDays) * 100;
    if (pct > 100) break;

    headers.push({
      label: `${SHORT_MONTHS[cursor.getMonth()]} ${cursor.getDate()}`,
      leftPct: pct,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return headers;
}

// ── grouping ─────────────────────────────────────────────

/**
 * Group work items by their first project association.
 * Returns a Map keyed by project ID → work items in that project.
 */
export function groupItemsByProject(
  workItems: WorkItem[],
): Map<string, WorkItem[]> {
  const map = new Map<string, WorkItem[]>();

  for (const wi of workItems) {
    const pid = wi.projectIds[0];
    if (!pid) continue;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(wi);
  }

  return map;
}

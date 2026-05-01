/**
 * Slot generation for the booking system.
 *
 * Core algorithm:
 *   1. expand each host's working hours into UTC intervals over the date range
 *   2. subtract padded busy intervals + override blocks; add override extras
 *   3. walk the slot grid and emit slots that satisfy the event-type's mode
 *
 * Pure module — no I/O, no Supabase calls, no fetch. Testable in isolation.
 *
 * Time-zone handling uses Intl.DateTimeFormat exclusively (no luxon/date-fns-tz)
 * to keep the CF Workers bundle small and avoid pulling in full IANA databases.
 */

import type { EventType, Host } from "./types";

export interface Interval {
  start: Date;
  end: Date;
}

export interface HostBusy {
  hostId: string;
  busy: Interval[];
  error?: string;
}

export interface Slot {
  start: Date;
  end: Date;
  /** For solo events, the host that's free. For round-robin, undefined (chosen at commit time). */
  hostHint?: string;
  /** For collective events, the hosts that are free for this slot. */
  freeHostIds?: string[];
}

// ── interval algebra ─────────────────────────────────────────────

/** Merge overlapping intervals into a sorted, non-overlapping list. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => +a.start - +b.start);
  const out: Interval[] = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (+cur.start <= +last.end) {
      if (+cur.end > +last.end) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

/** Subtract `subtract` from `from`. Both lists must be sorted, non-overlapping. */
export function subtractIntervals(from: Interval[], subtract: Interval[]): Interval[] {
  if (subtract.length === 0) return from.map((i) => ({ ...i }));
  const out: Interval[] = [];
  for (const f of from) {
    let cursor = +f.start;
    const fEnd = +f.end;
    for (const s of subtract) {
      const sStart = +s.start;
      const sEnd = +s.end;
      if (sEnd <= cursor) continue;
      if (sStart >= fEnd) break;
      if (sStart > cursor) out.push({ start: new Date(cursor), end: new Date(sStart) });
      cursor = Math.max(cursor, sEnd);
      if (cursor >= fEnd) break;
    }
    if (cursor < fEnd) out.push({ start: new Date(cursor), end: new Date(fEnd) });
  }
  return out;
}

/** Pad busy intervals by buffer minutes on each side. */
export function padBusy(busy: Interval[], beforeMin: number, afterMin: number): Interval[] {
  return busy.map((b) => ({
    start: new Date(+b.start - beforeMin * 60_000),
    end: new Date(+b.end + afterMin * 60_000),
  }));
}

/** Test whether a target interval is fully contained in any of the free intervals. */
export function containsInterval(free: Interval[], target: Interval): boolean {
  for (const f of free) {
    if (+f.start <= +target.start && +f.end >= +target.end) return true;
  }
  return false;
}

// ── timezone-aware working hours expansion ───────────────────────

/**
 * Expand a host's working_hours into a list of UTC intervals covering the
 * given date range, respecting the host's timezone (including DST).
 *
 * working_hours shape: {"mon":[["09:00","17:00"]],"tue":[...],...} where
 * keys are 3-letter day codes and values are [start, end] in 24-hour
 * local time. An empty array means closed that day.
 */
export function expandWorkingHours(host: Host, range: Interval): Interval[] {
  const out: Interval[] = [];
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  // Walk day-by-day in the host's local time. We enumerate calendar days
  // by iterating UTC and converting.
  const startMs = +range.start;
  const endMs = +range.end;

  // Convert range bounds into the host's local time so we can iterate days correctly.
  // We use a "start of day in local tz" cursor.
  let cursor = startOfDayInTz(new Date(startMs - 86_400_000), host.timezone);

  while (+cursor < endMs + 86_400_000) {
    const dayInfo = dayInfoInTz(cursor, host.timezone);
    const dayKey = dayKeys[dayInfo.dow];
    const windows = host.working_hours?.[dayKey] ?? [];
    for (const [startHHMM, endHHMM] of windows) {
      const localStart = combineLocalDateTime(dayInfo, startHHMM, host.timezone);
      const localEnd = combineLocalDateTime(dayInfo, endHHMM, host.timezone);
      if (+localStart >= +localEnd) continue;
      // Clip to range
      const clippedStart = +localStart < startMs ? new Date(startMs) : localStart;
      const clippedEnd = +localEnd > endMs ? new Date(endMs) : localEnd;
      if (+clippedStart < +clippedEnd) {
        out.push({ start: clippedStart, end: clippedEnd });
      }
    }
    cursor = new Date(+cursor + 86_400_000);
  }

  return mergeIntervals(out);
}

interface DayInfo {
  year: number;
  month: number;  // 1-12
  day: number;    // 1-31
  dow: number;    // 0=sun ... 6=sat
}

/** Return year/month/day/dow as observed in the given timezone. */
function dayInfoInTz(d: Date, timezone: string): DayInfo {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const wkd = (parts.find((p) => p.type === "weekday")?.value ?? "Sun").slice(0, 3);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: +(parts.find((p) => p.type === "year")?.value ?? 0),
    month: +(parts.find((p) => p.type === "month")?.value ?? 0),
    day: +(parts.find((p) => p.type === "day")?.value ?? 0),
    dow: dowMap[wkd] ?? 0,
  };
}

/** Get the start-of-day Date in UTC corresponding to the given date in `timezone`. */
function startOfDayInTz(d: Date, timezone: string): Date {
  const info = dayInfoInTz(d, timezone);
  return combineLocalDateTime(info, "00:00", timezone);
}

/**
 * Combine a calendar day (in `timezone`) with a HH:MM local time and return
 * the corresponding UTC Date. Handles DST transitions by using the offset
 * computed by Intl.DateTimeFormat for the candidate moment.
 */
function combineLocalDateTime(info: DayInfo, hhmm: string, timezone: string): Date {
  const [hStr, mStr] = hhmm.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  // Initial guess: treat as if the local time were UTC, then correct by the offset.
  const guess = Date.UTC(info.year, info.month - 1, info.day, hour, minute, 0, 0);
  const offset = tzOffsetMs(new Date(guess), timezone);
  // The actual UTC moment is guess - offset (because offset is "tz minus utc")
  return new Date(guess - offset);
}

/**
 * Return the offset of `timezone` from UTC at `instant`, in milliseconds.
 * Positive for east of UTC. Uses Intl to handle DST correctly.
 */
function tzOffsetMs(instant: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  // Some locales emit "24" for midnight; normalize.
  const h = get("hour") % 24;
  const localUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  return localUtcMs - +instant;
}

// ── slot grid ────────────────────────────────────────────────────

/** Round `t` up to the next multiple of `stepMs`. */
export function ceilToStep(t: Date, stepMs: number): Date {
  const ms = +t;
  return new Date(ms + ((stepMs - (ms % stepMs)) % stepMs));
}

// ── main entry point ─────────────────────────────────────────────

interface GenerateSlotsOptions {
  eventType: Pick<EventType, "mode" | "duration_min" | "slot_step_min" | "notice_min" | "min_required">;
  hosts: Host[];
  freeBusy: HostBusy[];
  /** host_id → list of override intervals (block→busy, extra→additional free) */
  overrides?: { blocks: Record<string, Interval[]>; extras: Record<string, Interval[]> };
  range: Interval;
  now?: Date;
}

export function generateSlots(opts: GenerateSlotsOptions): Slot[] {
  const now = opts.now ?? new Date();
  const earliest = new Date(+now + opts.eventType.notice_min * 60_000);
  const stepMs = opts.eventType.slot_step_min * 60_000;
  const durMs = opts.eventType.duration_min * 60_000;

  const blocks = opts.overrides?.blocks ?? {};
  const extras = opts.overrides?.extras ?? {};

  // Compute each host's free intervals over the range.
  const perHostFree = opts.hosts.map((h) => {
    const busy = mergeIntervals([
      ...(opts.freeBusy.find((f) => f.hostId === h.id)?.busy ?? []),
      ...(blocks[h.id] ?? []),
    ]);
    const work = expandWorkingHours(h, opts.range);
    const augmentedWork = mergeIntervals([...work, ...(extras[h.id] ?? [])]);
    const free = subtractIntervals(
      augmentedWork,
      padBusy(busy, h.buffer_before_min, h.buffer_after_min),
    );
    return { host: h, free };
  });

  const out: Slot[] = [];
  for (let t = ceilToStep(opts.range.start, stepMs); +t < +opts.range.end; t = new Date(+t + stepMs)) {
    if (+t < +earliest) continue;
    const slot: Interval = { start: t, end: new Date(+t + durMs) };
    if (+slot.end > +opts.range.end) break;

    if (opts.eventType.mode === "solo") {
      const ph = perHostFree[0];
      if (ph && containsInterval(ph.free, slot)) {
        out.push({ start: slot.start, end: slot.end, hostHint: ph.host.id });
      }
    } else if (opts.eventType.mode === "collective") {
      const free = perHostFree.filter((p) => containsInterval(p.free, slot));
      if (free.length >= opts.eventType.min_required) {
        out.push({
          start: slot.start,
          end: slot.end,
          freeHostIds: free.map((f) => f.host.id),
        });
      }
    } else {
      // round_robin
      const free = perHostFree.filter((p) => containsInterval(p.free, slot));
      if (free.length >= 1) {
        out.push({
          start: slot.start,
          end: slot.end,
          freeHostIds: free.map((f) => f.host.id),
        });
      }
    }
  }
  return out;
}

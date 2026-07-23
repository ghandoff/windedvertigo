/**
 * Generates concrete upcoming slots from the collective's working_hours.
 *
 * working_hours shape: Record<"mon"|"tue"|..., [startHH:MM, endHH:MM][]>
 *
 * Day filtering: a date is only included when ALL active hosts have at least
 * one window defined for that weekday (collective intersection).
 *
 * Display timezone + time windows: taken from `creatorHost` (the logged-in
 * user's host record). Falls back to the first active host if not supplied.
 *
 * `timeFrom`/`timeTo` override the natural start/end of the creator's windows
 * and can expand OR narrow the visible range.
 */

import type { Host, WorkingHours } from "./types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayKey = (typeof DAY_KEYS)[number];

function getTimezoneOffset(tz: string): number {
  // Returns offset in minutes from UTC for the given IANA timezone at "now".
  // We use this to build a local-wall-clock datetime string for datetime-local inputs.
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  return (local.getTime() - now.getTime()) / 60_000;
}

function toLocalIso(date: Date, tz: string): string {
  // Returns a datetime-local value (YYYY-MM-DDTHH:MM) in the given IANA timezone.
  const s = date.toLocaleString("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // en-CA gives "YYYY-MM-DD, HH:MM" — normalise to "YYYY-MM-DDTHH:MM"
  return s.replace(", ", "T").replace(",", "T");
}

export interface SuggestedSlot {
  startsAt: string; // datetime-local string (no tz suffix) for use in <input type="datetime-local">
  endsAt: string;
  label: string; // human-readable label e.g. "mon 7 jul · 09:00–17:00"
}

/**
 * Returns upcoming working windows for the collective (intersection across all
 * active hosts) over the next `daysAhead` calendar days.
 *
 * "Intersection" means a slot is only included when EVERY active host with
 * working_hours set has at least one window on that weekday — if any host has
 * no availability that day we skip it.
 *
 * The display timezone and time windows come from `creatorHost` (the logged-in
 * user's host record). Falls back to the first active host when not supplied.
 *
 * `timeFrom`/`timeTo` override the creator's natural window start/end, and can
 * expand OR narrow the visible time range (e.g. "06:00"–"16:00").
 *
 * @param startDate Optional start date (defaults to tomorrow).
 * @param creatorHost The host record for whoever is creating the poll.
 * @param timeFrom Override the start of the displayed time window (HH:MM).
 * @param timeTo Override the end of the displayed time window (HH:MM).
 */
export function suggestCollectiveSlots(
  hosts: Host[],
  daysAhead = 28,
  startDate?: Date,
  creatorHost?: Host,
  timeFrom?: string,
  timeTo?: string,
): SuggestedSlot[] {
  const active = hosts.filter((h) => {
    const hours = h.poll_hours ?? h.working_hours;
    return h.active && hours && Object.keys(hours).length > 0;
  });
  if (active.length === 0) return [];

  // Use the creator's timezone for all wall-clock display. Fallback to first
  // active host so the function still works when called without auth context.
  const displayHost = creatorHost ?? active[0];
  const tz = displayHost.timezone || "America/Los_Angeles";
  const creatorWh: WorkingHours = displayHost.poll_hours ?? displayHost.working_hours ?? {};

  const slots: SuggestedSlot[] = [];
  const now = new Date();

  // Base at noon to avoid DST edge cases when computing weekday in remote timezones.
  // When no startDate is given, start from tomorrow (matching the original d=1 behaviour).
  const base = startDate
    ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(base);
    date.setDate(base.getDate() + d);

    // Get the weekday in the host's timezone by reading the "en-US" locale date string.
    // new Date(toLocaleString(...)) gives us a Date whose .getDay() reflects the local wall clock.
    const localDay = new Date(date.toLocaleString("en-US", { timeZone: tz })).getDay();
    const dayKey = DAY_KEYS[localDay] as DayKey;

    // Collect windows for this day from every active host (intersection check only)
    const windowsByHost: [string, string][][] = active.map((h) => {
      const wh: WorkingHours = h.poll_hours ?? h.working_hours ?? {};
      return wh[dayKey] ?? [];
    });

    // Intersection: only emit a window if ALL hosts have at least one window on this day
    const allHaveWindows = windowsByHost.every((w) => w.length > 0);
    if (!allHaveWindows) continue;

    // Display windows come from the creator's hours (not the first active host)
    const naturalWindows: [string, string][] =
      creatorWh[dayKey] ?? windowsByHost[0] ?? [];
    if (naturalWindows.length === 0) continue;

    // Apply timeFrom/timeTo override: collapse to a single explicit range.
    // This lets the creator expand (e.g. 06:00 start) or narrow the visible grid.
    let windows: [string, string][];
    if (timeFrom || timeTo) {
      const naturalStart = naturalWindows[0][0];
      const naturalEnd = naturalWindows[naturalWindows.length - 1][1];
      windows = [[timeFrom ?? naturalStart, timeTo ?? naturalEnd]];
    } else {
      windows = naturalWindows;
    }

    // Format the date part in tz for display
    const dateLabel = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const localDateStr = date.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

    for (const [startTime, endTime] of windows) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const windowStartMins = sh * 60 + sm;
      const windowEndMins = eh * 60 + em;

      // Decompose each working window into 30-minute blocks (Doodle-style).
      for (let slotStart = windowStartMins; slotStart < windowEndMins; slotStart += 30) {
        const slotEnd = Math.min(slotStart + 30, windowEndMins);
        const sh2 = Math.floor(slotStart / 60), sm2 = slotStart % 60;
        const eh2 = Math.floor(slotEnd / 60), em2 = slotEnd % 60;
        const s = `${String(sh2).padStart(2, "0")}:${String(sm2).padStart(2, "0")}`;
        const e = `${String(eh2).padStart(2, "0")}:${String(em2).padStart(2, "0")}`;
        slots.push({
          startsAt: `${localDateStr}T${s}`,
          endsAt: `${localDateStr}T${e}`,
          label: `${dateLabel} · ${s}–${e}`,
        });
      }
    }
  }

  return slots;
}

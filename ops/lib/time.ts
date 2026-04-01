/**
 * lib/time.ts — Timezone-aware formatting utilities
 *
 * All display times should go through these helpers so they render
 * in the viewer's local timezone. The collective spans multiple TZs
 * (US-Eastern, UTC, etc.), so we rely on the browser's Intl API.
 *
 * Data storage stays in UTC (ISO 8601). Only the display layer localises.
 */

/**
 * Convert a UTC time string like "4:00 PM" to the viewer's local time.
 * Useful for recurring meeting times stored as UTC in the data layer.
 *
 * Returns { localTime, tzAbbr } — e.g. { localTime: "12:00p", tzAbbr: "EDT" }
 */
export function utcTimeToLocal(
  utcTime: string,
  dayOfWeek?: string,
): { localTime: string; tzAbbr: string } {
  // Parse "4:00 PM" or "4:00PM" style strings
  const match = utcTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { localTime: utcTime, tzAbbr: '' };

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  // Convert 12-hour to 24-hour if AM/PM present
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  // Build a real Date in UTC to let the browser convert
  // Use the next occurrence of the given day, or today
  const now = new Date();
  const base = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
  ));

  // If a day of week is given, adjust to next occurrence
  if (dayOfWeek) {
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const target = dayMap[dayOfWeek.toLowerCase()];
    if (target !== undefined) {
      const current = base.getUTCDay();
      const diff = (target - current + 7) % 7;
      base.setUTCDate(base.getUTCDate() + diff);
    }
  }

  // Format in viewer's local timezone
  const localTime = base.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase().replace(':00', '').replace(' ', '');

  // Get timezone abbreviation
  const tzAbbr = new Intl.DateTimeFormat([], {
    timeZoneName: 'short',
  }).formatToParts(base).find(p => p.type === 'timeZoneName')?.value ?? '';

  return { localTime, tzAbbr };
}

/**
 * Format an ISO date string in the viewer's local timezone.
 * e.g. "2026-04-10" → "Apr 10"
 */
export function localDate(
  isoDate: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const defaults: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  return new Date(isoDate).toLocaleDateString(undefined, options ?? defaults);
}

/**
 * Format the header date string in viewer's local timezone.
 * e.g. "sat, mar 29" — lowercase w.v brand voice
 */
export function localHeaderDate(): string {
  return new Date()
    .toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toLowerCase();
}

/**
 * Format an ISO timestamp as a local date+time string.
 * e.g. "2026-03-28T12:00:00Z" → "Mar 28, 12:00 PM EDT"
 */
export function localDateTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Get the viewer's timezone abbreviation.
 * e.g. "EDT", "UTC", "CST"
 */
export function localTzAbbr(): string {
  return new Intl.DateTimeFormat([], {
    timeZoneName: 'short',
  }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '';
}

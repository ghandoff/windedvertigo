/**
 * Shared formatting utilities — prevents duplication across pages.
 */

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight.
 *
 * `new Date("2026-05-04")` parses as UTC midnight — rendered via
 * `toLocaleDateString` in a UTC-7 browser it shows May 3 (17:00 local).
 * Constructing `new Date(y, m-1, d)` always gives local midnight, which
 * is consistent on both server (Vercel/UTC) and client (browser/PT).
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a date as "Jan 5" (no year). Null-safe. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return parseDateOnly(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Format a date as "Jan 5, 2026" (with year). Null-safe. */
export function formatDateWithYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return parseDateOnly(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Convert a funder's due-date to a Pacific Time label.
 *
 * If the TOR declares a timezone (e.g. "Europe/Copenhagen"), we assume the
 * deadline is at 5 pm in that timezone and return what time that is in PT.
 * Example: May 4 5pm CEST (UTC+2) → "8am PT"
 *
 * Uses the built-in Intl API — no date libraries needed. Handles DST correctly
 * because we reference the actual deadline date, not a fixed offset.
 *
 * Returns null if the timezone is unknown or invalid.
 */
export function deadlineAsPT(
  dateStr: string,
  ianaTimezone: string | null | undefined,
): string | null {
  if (!ianaTimezone) return null;
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    // Find what hour it is in the funder's timezone when it's noon UTC on that date.
    // This gives us the UTC→funder offset (DST-correct).
    const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const localHour = parseInt(
      noonUTC.toLocaleString("en-US", {
        timeZone: ianaTimezone,
        hour: "numeric",
        hour12: false,
      }),
      10,
    );
    const utcOffsetHours = localHour - 12; // e.g. CEST(+2) → 14-12=2

    // 5pm funder local = UTC 17:00 − offset
    const deadlineUTCHour = 17 - utcOffsetHours;
    const deadlineUTC = new Date(Date.UTC(y, m - 1, d, deadlineUTCHour, 0, 0));

    // Format in Pacific Time (PDT/PST auto-selected by Intl)
    const ptLabel = deadlineUTC.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: true,
    }); // e.g. "8 AM"

    return ptLabel.toLowerCase().replace(" ", ""); // "8am"
  } catch {
    return null;
  }
}

/** Format a number as USD currency (e.g., "$1,275.00"). */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

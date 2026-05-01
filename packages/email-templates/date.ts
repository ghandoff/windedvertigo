/**
 * @windedvertigo/email-templates — Intl date formatting helpers
 *
 * These helpers format Date objects into human-readable strings for email
 * bodies. They use the Intl API which is available everywhere (Node, CF Workers,
 * browsers). All output is in the viewer's timezone.
 */

/**
 * Format a date + time range for display in email bodies.
 * Example: "Thursday, May 1 · 10:00 AM → 11:00 AM PDT"
 */
export function formatDateRange(start: Date, end: Date, tz: string): string {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)} → ${timeFmt.format(end)}`;
}

/**
 * Format just the date portion of a timestamp.
 * Example: "May 1"
 */
export function formatDateOnly(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: tz,
  }).format(d);
}

/**
 * Whirlpool cycle helper.
 *
 * A "cycle" is the ISO Monday (YYYY-MM-DD, UTC) of a given week — the grouping
 * key for the PaM whirlpool board. The PaM page and whirlpool-checkin cron both
 * compute this inline; new bridge code shares it from here.
 */

/** ISO Monday (YYYY-MM-DD, UTC) of the week containing `date` (default: now). */
export function currentCycleMonday(date: Date = new Date()): string {
  const day = date.getUTCDay(); // 0=Sun … 6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

/**
 * Input validation helpers for API routes.
 *
 * Session 12 audit fix: POST bodies had no upper-bound length checks,
 * meaning an attacker could submit megabytes of text that gets stored
 * directly in Postgres. These helpers enforce sane maximums.
 */

/** Max lengths for common field types. */
export const MAX_LENGTHS = {
  /** Short label fields (title, name, slug) */
  title: 500,
  /** Free-text fields (what_changed, next_iteration, notes) */
  freeText: 5_000,
  /** Domain names */
  domain: 253,
  /** Email addresses (RFC 5321) */
  email: 254,
  /** UUID strings */
  uuid: 36,
  /** Array tags (context_tags, trace_evidence) — per-item */
  tag: 100,
  /** Max items in an array field */
  arrayMax: 50,
} as const;

/**
 * Truncate a string to a maximum length. Returns the trimmed value.
 * Returns null if the input is null/undefined.
 */
export function truncate(
  value: string | null | undefined,
  max: number,
): string | null {
  if (value == null) return null;
  return value.slice(0, max);
}

/**
 * Validate that a string doesn't exceed a maximum length.
 * Returns an error message if it does, null if OK.
 */
export function checkLength(
  fieldName: string,
  value: unknown,
  max: number,
): string | null {
  if (typeof value !== "string") return null;
  if (value.length > max) {
    return `${fieldName} exceeds maximum length of ${max} characters`;
  }
  return null;
}

/**
 * Validate and clamp an array: ensure each item is a string within
 * maxItemLen, and the array has at most maxItems entries.
 */
export function sanitiseStringArray(
  arr: unknown,
  maxItems: number = MAX_LENGTHS.arrayMax,
  maxItemLen: number = MAX_LENGTHS.tag,
): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === "string")
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxItemLen));
}

/**
 * Validate a UUID-shaped string. Returns true if it looks like a UUID.
 */
export function isValidUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Vault row transformation: compute derived fields at read time so we
 * decouple stored DB values from R2 URL conventions.
 *
 * Specifically: convert `cover_r2_key` (a stable storage key) into a
 * `cover_url` (the public URL on R2 right now) using the current
 * R2_PUBLIC_URL env var. If we ever migrate R2 buckets again, only the
 * env var changes — no DB migration needed.
 */

import { imageUrl } from "@/lib/sync/sync-image";

/**
 * Transform a raw DB row by computing `cover_url` from `cover_r2_key`.
 *
 * Returns a new object that:
 *   - keeps all original fields
 *   - adds `cover_url` (computed from `cover_r2_key` + R2_PUBLIC_URL)
 *   - drops `cover_r2_key` from the public shape (it's an internal detail)
 *
 * If `cover_r2_key` is missing or null, `cover_url` is null.
 *
 * The return type is loose (`any`-shaped) because callers come from raw
 * SQL queries with dynamic column lists (tier-based) and TypeScript can't
 * narrow that. Callers that need a strict type should cast the result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapVaultRow(row: any): any {
  if (!row) return row;
  const { cover_r2_key, ...rest } = row;
  return {
    ...rest,
    cover_url: imageUrl(cover_r2_key ?? null),
  };
}

/** Apply `mapVaultRow` to an array of rows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapVaultRows(rows: any[]): any[] {
  return rows.map(mapVaultRow);
}

/**
 * Picker data queries for matcher (used by the server page to populate the form).
 */

import { sql } from "@/lib/db";

/** Distinct required_forms values across all ready public playdates. */
export async function getDistinctForms(): Promise<string[]> {
  const result = await sql.query(
    `SELECT DISTINCT val AS form
     FROM playdates_cache,
          jsonb_array_elements_text(required_forms) AS val
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY form ASC`,
  );
  return result.rows.map((r: any) => r.form);
}

/** Distinct slots_optional values across all ready public playdates. */
export async function getDistinctSlots(): Promise<string[]> {
  const result = await sql.query(
    `SELECT DISTINCT val AS slot
     FROM playdates_cache,
          jsonb_array_elements_text(slots_optional) AS val
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY slot ASC`,
  );
  return result.rows.map((r: any) => r.slot);
}

/** Distinct context_tags values across all ready public playdates. */
export async function getDistinctContexts(): Promise<string[]> {
  const result = await sql.query(
    `SELECT DISTINCT val AS context
     FROM playdates_cache,
          jsonb_array_elements_text(context_tags) AS val
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY context ASC`,
  );
  return result.rows.map((r: any) => r.context);
}

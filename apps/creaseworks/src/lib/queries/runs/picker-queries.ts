/**
 * Picker data queries for runs.
 */

import { sql } from "@/lib/db";

/**
 * Get all ready playdates for the "link to playdate" picker.
 * Returns just id, title, slug for the dropdown.
 */
export async function getReadyPlaydatesForPicker(): Promise<
  { id: string; title: string; slug: string }[]
> {
  const result = await sql.query(
    `SELECT id, title, slug
     FROM playdates_cache
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY title ASC`,
  );
  return result.rows;
}

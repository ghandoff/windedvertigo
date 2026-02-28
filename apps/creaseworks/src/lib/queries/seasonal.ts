/**
 * Seasonal playdate queries
 *
 * Queries for fetching seasonal playdates based on campaign tags that
 * match the current season.
 */

import { sql } from "@/lib/db";
import {
  PLAYDATE_TEASER_COLUMNS,
} from "@/lib/security/column-selectors";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";
import { safeCols } from "@/lib/db-compat";
import { getSeasonalTags } from "@/lib/seasonal";

/**
 * Fetch seasonal playdates that match the current season's campaign tags.
 *
 * Returns playdates whose campaign_tags overlap with the seasonal tags,
 * ordered alphabetically.
 *
 * @param limit - Maximum number of playdates to return (default: 6)
 * @returns Array of playdate rows matching seasonal criteria
 */
export async function getSeasonalPlaydates(limit: number = 6) {
  const seasonalTags = getSeasonalTags();
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");

  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again,
       COALESCE(rc.run_count, 0)::int AS run_count
     FROM playdates_cache p
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     WHERE p.status = 'ready'
       AND p.release_channel = 'sampler'
       AND p.campaign_tags && $1::text[]
     ORDER BY p.title ASC
     LIMIT $2`,
    [seasonalTags, limit],
  );

  assertNoLeakedFields(result.rows, "teaser");

  return result.rows;
}

/**
 * Server-side search across playdates, collections, and materials.
 *
 * Uses ILIKE for case-insensitive substring matching across multiple
 * text fields. Returns teaser-safe columns only — no entitled content
 * leaks through search results.
 *
 * Phase 2 — P2-2: server-side playdate search.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface PlaydateSearchResult {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  cover_url: string | null;
  icon_emoji: string | null;
  collection_title: string | null;
  collection_slug: string | null;
  match_field: string; // which field matched ("title", "headline", "material", etc.)
}

export interface CollectionSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon_emoji: string | null;
  cover_url: string | null;
  playdate_count: number;
}

export interface SearchResults {
  playdates: PlaydateSearchResult[];
  collections: CollectionSearchResult[];
  query: string;
}

/* ------------------------------------------------------------------ */
/*  search queries                                                     */
/* ------------------------------------------------------------------ */

/**
 * Search playdates by title, headline, rails_sentence, and linked
 * material titles. Returns teaser-safe fields only.
 *
 * All ready playdates are searchable — entitlement checks happen at
 * the page level when the user actually tries to view the playdate.
 */
export async function searchPlaydates(
  query: string,
  limit = 20,
): Promise<PlaydateSearchResult[]> {
  const pattern = `%${query}%`;

  const result = await sql.query(
    `WITH playdate_matches AS (
       -- Match on playdate title
       SELECT p.id, p.slug, p.title, p.headline, p.primary_function,
              p.cover_url, NULL AS icon_emoji,
              'title' AS match_field,
              1 AS rank
       FROM playdates_cache p
       WHERE p.status = 'ready'
         AND p.title ILIKE $1

       UNION ALL

       -- Match on playdate headline
       SELECT p.id, p.slug, p.title, p.headline, p.primary_function,
              p.cover_url, NULL AS icon_emoji,
              'headline' AS match_field,
              2 AS rank
       FROM playdates_cache p
       WHERE p.status = 'ready'
         AND p.headline ILIKE $1
         AND p.title NOT ILIKE $1  -- avoid duplicates with title match

       UNION ALL

       -- Match on rails_sentence (the "what you'll do" summary)
       SELECT p.id, p.slug, p.title, p.headline, p.primary_function,
              p.cover_url, NULL AS icon_emoji,
              'description' AS match_field,
              3 AS rank
       FROM playdates_cache p
       WHERE p.status = 'ready'
         AND p.rails_sentence ILIKE $1
         AND p.title NOT ILIKE $1
         AND (p.headline IS NULL OR p.headline NOT ILIKE $1)

       UNION ALL

       -- Match on linked material title
       SELECT DISTINCT ON (p.id)
              p.id, p.slug, p.title, p.headline, p.primary_function,
              p.cover_url, NULL AS icon_emoji,
              'material' AS match_field,
              4 AS rank
       FROM playdates_cache p
       JOIN playdate_materials pm ON pm.playdate_id = p.id
       JOIN materials_cache m ON m.id = pm.material_id
       WHERE p.status = 'ready'
         AND m.title ILIKE $1
         AND p.title NOT ILIKE $1
         AND (p.headline IS NULL OR p.headline NOT ILIKE $1)
         AND (p.rails_sentence IS NULL OR p.rails_sentence NOT ILIKE $1)
     ),
     -- Deduplicate: keep the highest-priority match per playdate
     ranked AS (
       SELECT DISTINCT ON (id) *
       FROM playdate_matches
       ORDER BY id, rank ASC
     )
     -- Join the first matching collection for context
     SELECT r.id, r.slug, r.title, r.headline, r.primary_function,
            r.cover_url, r.icon_emoji, r.match_field,
            c.title AS collection_title, c.slug AS collection_slug
     FROM ranked r
     LEFT JOIN collection_playdates cp ON cp.playdate_id = r.id
     LEFT JOIN collections c ON c.id = cp.collection_id
     ORDER BY r.rank ASC, r.title ASC
     LIMIT $2`,
    [pattern, limit],
  );

  return result.rows;
}

/**
 * Search collections by title and description.
 */
export async function searchCollections(
  query: string,
  limit = 10,
): Promise<CollectionSearchResult[]> {
  const pattern = `%${query}%`;

  const result = await sql.query(
    `SELECT c.id, c.slug, c.title, c.description, c.icon_emoji, c.cover_url,
            COUNT(cp.playdate_id)::int AS playdate_count
     FROM collections c
     LEFT JOIN collection_playdates cp ON cp.collection_id = c.id
     WHERE c.status = 'published'
       AND (c.title ILIKE $1 OR c.description ILIKE $1)
     GROUP BY c.id
     ORDER BY c.title ASC
     LIMIT $2`,
    [pattern, limit],
  );

  return result.rows;
}

/**
 * Combined search: playdates + collections.
 * Returns both result sets for the client to display in sections.
 */
export async function search(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { playdates: [], collections: [], query: trimmed };
  }

  const [playdates, collections] = await Promise.all([
    searchPlaydates(trimmed),
    searchCollections(trimmed),
  ]);

  return { playdates, collections, query: trimmed };
}

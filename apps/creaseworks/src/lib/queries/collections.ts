/**
 * Collection & progress queries — the playbook data layer.
 *
 * Collections are topical groupings of playdates (puddle scientists,
 * cardboard architects…). Progress is derived from runs_cache and
 * cached in playdate_progress for quick reads.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface Collection {
  id: string;
  title: string;
  description: string | null;
  icon_emoji: string | null;
  slug: string;
  sort_order: number;
  playdate_count: number;
}

export interface CollectionWithProgress extends Collection {
  tried_count: number;
  found_count: number;
  folded_count: number;
  found_again_count: number;
}

export interface CollectionPlaydate {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  arc_emphasis: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  has_find_again: boolean;
  progress_tier: string | null;
}

export interface ProgressSummary {
  total_tried: number;
  total_found: number;
  total_folded: number;
  total_found_again: number;
}

export interface ArcCoverage {
  arc: string;
  tried: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/*  collection listing                                                 */
/* ------------------------------------------------------------------ */

/**
 * All ready collections with playdate counts.
 * Used on the playbook page for the collection grid.
 */
export async function getReadyCollections(): Promise<Collection[]> {
  const result = await sql.query(
    `SELECT c.id, c.title, c.description, c.icon_emoji, c.slug, c.sort_order,
            COUNT(cp.playdate_id)::int AS playdate_count
     FROM collections c
     LEFT JOIN collection_playdates cp ON cp.collection_id = c.id
     WHERE c.status = 'ready'
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.title ASC`,
  );
  return result.rows;
}

/**
 * All ready collections with per-user progress counts.
 * One query — no N+1.
 */
export async function getCollectionsWithProgress(
  userId: string,
): Promise<CollectionWithProgress[]> {
  const result = await sql.query(
    `SELECT c.id, c.title, c.description, c.icon_emoji, c.slug, c.sort_order,
            COUNT(DISTINCT cp.playdate_id)::int AS playdate_count,
            COUNT(DISTINCT CASE WHEN pp.progress_tier IS NOT NULL THEN cp.playdate_id END)::int AS tried_count,
            COUNT(DISTINCT CASE WHEN pp.progress_tier IN ('found_something','folded_unfolded','found_again') THEN cp.playdate_id END)::int AS found_count,
            COUNT(DISTINCT CASE WHEN pp.progress_tier IN ('folded_unfolded','found_again') THEN cp.playdate_id END)::int AS folded_count,
            COUNT(DISTINCT CASE WHEN pp.progress_tier = 'found_again' THEN cp.playdate_id END)::int AS found_again_count
     FROM collections c
     LEFT JOIN collection_playdates cp ON cp.collection_id = c.id
     LEFT JOIN playdate_progress pp
       ON pp.playdate_id = cp.playdate_id AND pp.user_id = $1
     WHERE c.status = 'ready'
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.title ASC`,
    [userId],
  );
  return result.rows;
}

/* ------------------------------------------------------------------ */
/*  single collection detail                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch a single collection by slug.
 */
export async function getCollectionBySlug(
  slug: string,
): Promise<Collection | null> {
  const result = await sql.query(
    `SELECT c.id, c.title, c.description, c.icon_emoji, c.slug, c.sort_order,
            COUNT(cp.playdate_id)::int AS playdate_count
     FROM collections c
     LEFT JOIN collection_playdates cp ON cp.collection_id = c.id
     WHERE c.slug = $1
     GROUP BY c.id
     LIMIT 1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

/**
 * Fetch playdates in a collection with per-user progress.
 * Returns teaser-level columns (safe for any logged-in user).
 */
export async function getCollectionPlaydates(
  collectionId: string,
  userId: string | null,
): Promise<CollectionPlaydate[]> {
  const result = await sql.query(
    `SELECT p.id, p.slug, p.title, p.headline,
            p.primary_function, p.arc_emphasis,
            p.friction_dial, p.start_in_120s,
            (p.find_again_mode IS NOT NULL) AS has_find_again,
            pp.progress_tier
     FROM playdates_cache p
     JOIN collection_playdates cp ON cp.playdate_id = p.id
     LEFT JOIN playdate_progress pp
       ON pp.playdate_id = p.id AND pp.user_id = $2
     WHERE cp.collection_id = $1
       AND p.status = 'ready'
     ORDER BY cp.display_order ASC, p.title ASC`,
    [collectionId, userId],
  );
  return result.rows;
}

/* ------------------------------------------------------------------ */
/*  user progress                                                      */
/* ------------------------------------------------------------------ */

/**
 * Aggregate progress summary for a user across all playdates.
 */
export async function getUserProgressSummary(
  userId: string,
): Promise<ProgressSummary> {
  const result = await sql.query(
    `SELECT
       COUNT(*)::int AS total_tried,
       COUNT(*) FILTER (WHERE progress_tier IN ('found_something','folded_unfolded','found_again'))::int AS total_found,
       COUNT(*) FILTER (WHERE progress_tier IN ('folded_unfolded','found_again'))::int AS total_folded,
       COUNT(*) FILTER (WHERE progress_tier = 'found_again')::int AS total_found_again
     FROM playdate_progress
     WHERE user_id = $1 AND progress_tier IS NOT NULL`,
    [userId],
  );
  return result.rows[0] ?? {
    total_tried: 0,
    total_found: 0,
    total_folded: 0,
    total_found_again: 0,
  };
}

/**
 * Developmental arc coverage: for each arc, how many playdates has
 * the user tried vs. total playdates with that arc.
 *
 * arc_emphasis is a JSONB array, so we unnest it.
 */
export async function getArcCoverage(
  userId: string,
): Promise<ArcCoverage[]> {
  const result = await sql.query(
    `WITH all_arcs AS (
       SELECT DISTINCT jsonb_array_elements_text(arc_emphasis) AS arc
       FROM playdates_cache
       WHERE status = 'ready'
     ),
     arc_totals AS (
       SELECT jsonb_array_elements_text(arc_emphasis) AS arc,
              COUNT(DISTINCT id)::int AS total
       FROM playdates_cache
       WHERE status = 'ready'
       GROUP BY arc
     ),
     user_arcs AS (
       SELECT jsonb_array_elements_text(p.arc_emphasis) AS arc,
              COUNT(DISTINCT p.id)::int AS tried
       FROM playdate_progress pp
       JOIN playdates_cache p ON p.id = pp.playdate_id
       WHERE pp.user_id = $1 AND pp.progress_tier IS NOT NULL
       GROUP BY arc
     )
     SELECT at.arc,
            COALESCE(ua.tried, 0)::int AS tried,
            at.total
     FROM arc_totals at
     LEFT JOIN user_arcs ua ON ua.arc = at.arc
     ORDER BY at.arc ASC`,
    [userId],
  );
  return result.rows;
}

/**
 * Suggest the next collection to explore based on least-covered arc.
 * Returns null if user has explored everything evenly or has no progress.
 */
export async function getNextSuggestion(
  userId: string,
): Promise<{ collection: Collection; reason: string } | null> {
  // Find the least-explored arc (by % coverage)
  const arcResult = await sql.query(
    `WITH user_arcs AS (
       SELECT jsonb_array_elements_text(p.arc_emphasis) AS arc,
              COUNT(DISTINCT p.id) AS tried
       FROM playdate_progress pp
       JOIN playdates_cache p ON p.id = pp.playdate_id
       WHERE pp.user_id = $1 AND pp.progress_tier IS NOT NULL
       GROUP BY arc
     ),
     arc_totals AS (
       SELECT jsonb_array_elements_text(arc_emphasis) AS arc,
              COUNT(DISTINCT id) AS total
       FROM playdates_cache WHERE status = 'ready'
       GROUP BY arc
     )
     SELECT at.arc,
            COALESCE(ua.tried, 0) AS tried,
            at.total,
            COALESCE(ua.tried::float / NULLIF(at.total, 0), 0) AS coverage
     FROM arc_totals at
     LEFT JOIN user_arcs ua ON ua.arc = at.arc
     WHERE at.total > 0
     ORDER BY coverage ASC, at.total DESC
     LIMIT 1`,
    [userId],
  );

  if (arcResult.rows.length === 0) return null;
  const leastArc = arcResult.rows[0];

  // Skip suggestion if coverage is already decent (>60%) for all arcs
  if (leastArc.coverage > 0.6) return null;

  // Find a collection that has playdates with this arc that user hasn't tried
  const collResult = await sql.query(
    `SELECT c.id, c.title, c.description, c.icon_emoji, c.slug, c.sort_order,
            COUNT(DISTINCT cp.playdate_id)::int AS playdate_count
     FROM collections c
     JOIN collection_playdates cp ON cp.collection_id = c.id
     JOIN playdates_cache p ON p.id = cp.playdate_id
     WHERE c.status = 'ready'
       AND p.status = 'ready'
       AND p.arc_emphasis ? $1
       AND NOT EXISTS (
         SELECT 1 FROM playdate_progress pp
         WHERE pp.playdate_id = p.id AND pp.user_id = $2
           AND pp.progress_tier IS NOT NULL
       )
     GROUP BY c.id
     ORDER BY COUNT(DISTINCT cp.playdate_id) DESC
     LIMIT 1`,
    [leastArc.arc, userId],
  );

  if (collResult.rows.length === 0) return null;

  return {
    collection: collResult.rows[0],
    reason: `you haven't explored much ${leastArc.arc} play yet`,
  };
}

/* ------------------------------------------------------------------ */
/*  progress computation (on-demand per user)                          */
/* ------------------------------------------------------------------ */

/**
 * Recompute playdate_progress for a single user from their runs.
 * Called when the playbook page loads. Returns count of rows upserted.
 *
 * Tier logic:
 *   tried_it        — ≥1 run for this playdate
 *   found_something — any run has trace_evidence (non-empty JSONB array)
 *   folded_unfolded — runs span 2+ different ISO weeks
 *   found_again     — any run has is_find_again = true
 */
export async function recomputeUserProgress(
  userId: string,
): Promise<number> {
  const result = await sql.query(
    `WITH run_data AS (
       SELECT
         p.id AS playdate_id,
         MIN(r.run_date) AS first_run,
         -- found_something: any run has evidence (quick-log OR structured)
         MAX(CASE WHEN jsonb_array_length(COALESCE(r.trace_evidence, '[]'::jsonb)) > 0
                       OR EXISTS (SELECT 1 FROM run_evidence re WHERE re.run_id = r.id)
                  THEN r.run_date END) AS found_date,
         -- folded: runs in 2+ distinct weeks
         CASE WHEN COUNT(DISTINCT date_trunc('week', r.run_date)) >= 2
              THEN MIN(r.run_date) FILTER (
                WHERE date_trunc('week', r.run_date) != (
                  SELECT MIN(date_trunc('week', r2.run_date))
                  FROM runs_cache r2
                  WHERE r2.playdate_notion_id = p.notion_id
                    AND r2.created_by = $1
                )
              ) END AS folded_date,
         -- found_again: explicitly flagged
         MAX(CASE WHEN r.is_find_again = true THEN r.run_date END) AS found_again_date
       FROM runs_cache r
       JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
       WHERE r.created_by = $1
         AND r.playdate_notion_id IS NOT NULL
       GROUP BY p.id
     )
     INSERT INTO playdate_progress (user_id, playdate_id, progress_tier,
       tried_at, found_at, folded_at, found_again_at, updated_at)
     SELECT
       $1,
       rd.playdate_id,
       CASE
         WHEN rd.found_again_date IS NOT NULL THEN 'found_again'
         WHEN rd.folded_date IS NOT NULL THEN 'folded_unfolded'
         WHEN rd.found_date IS NOT NULL THEN 'found_something'
         ELSE 'tried_it'
       END,
       rd.first_run,
       rd.found_date,
       rd.folded_date,
       rd.found_again_date,
       NOW()
     FROM run_data rd
     ON CONFLICT (user_id, playdate_id) DO UPDATE SET
       progress_tier = EXCLUDED.progress_tier,
       tried_at = EXCLUDED.tried_at,
       found_at = EXCLUDED.found_at,
       folded_at = EXCLUDED.folded_at,
       found_again_at = EXCLUDED.found_again_at,
       updated_at = NOW()`,
    [userId],
  );

  return result.rowCount ?? 0;
}

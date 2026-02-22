import { sql } from "@/lib/db";
import {
  PATTERN_TEASER_COLUMNS,
  PATTERN_ENTITLED_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";

/**
 * Fetch all public-ready patterns with teaser-tier columns only.
 * Used on the /sampler page grid.
 */
export async function getTeaserPatterns() {
  const cols = columnsToSql(PATTERN_TEASER_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols},
       (find_again_mode IS NOT NULL) AS has_find_again
     FROM patterns_cache
     WHERE status = 'ready'
       AND release_channel = 'sampler'
     ORDER BY title ASC`,
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows;
}

/**
 * Fetch a single pattern by slug at teaser tier.
 */
export async function getTeaserPatternBySlug(slug: string) {
  const cols = columnsToSql(PATTERN_TEASER_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols},
       (find_again_mode IS NOT NULL) AS has_find_again
     FROM patterns_cache
     WHERE slug = $1
       AND status = 'ready'
       AND release_channel = 'sampler'
     LIMIT 1`,
    [slug],
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows[0] ?? null;
}

/**
 * Fetch a single pattern by slug at entitled tier.
 * Caller must verify entitlement before calling.
 */
export async function getEntitledPatternBySlug(slug: string) {
  const cols = columnsToSql(PATTERN_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols}
     FROM patterns_cache
     WHERE slug = $1
       AND status = 'ready'
     LIMIT 1`,
    [slug],
  );
  assertNoLeakedFields(result.rows, "entitled");
  return result.rows[0] ?? null;
}

/**
 * Fetch a single pattern by UUID at entitled tier.
 * Used by the PDF generation route (lookup by id instead of slug).
 * Caller must verify entitlement before calling.
 */
export async function getEntitledPatternById(id: string) {
  const cols = columnsToSql(PATTERN_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols}
     FROM patterns_cache
     WHERE id = $1
       AND status = 'ready'
     LIMIT 1`,
    [id],
  );
  assertNoLeakedFields(result.rows, "entitled");
  return result.rows[0] ?? null;
}

/**
 * Fetch teaser-tier materials linked to a pattern (by pattern UUID).
 */
export async function getTeaserMaterialsForPattern(patternId: string) {
  const result = await sql.query(
    `SELECT m.id, m.title, m.form_primary, m.functions, m.context_tags
     FROM materials_cache m
     JOIN pattern_materials pm ON pm.material_id = m.id
     WHERE pm.pattern_id = $1
       AND m.do_not_use = false
     ORDER BY m.title ASC`,
    [patternId],
  );
  return result.rows;
}

/**
 * Candidate cache and grouping logic.
 *
 * In-memory cache for candidate rows. Playdates only change when the
 * Notion sync runs (at most once per hour via cron), so a 5-minute
 * TTL eliminates redundant full-table scans while staying fresh.
 *
 * Audit fix #10: getCandidateRows() did a full table scan on every
 * matcher request with no caching.
 */

import { sql } from "@/lib/db";
import { CandidateRow, PlaydateCandidate } from "./types";

/** Translate friction dial to parent-friendly energy level label */
function getEnergyLevel(frictionDial: number | null): string | null {
  if (frictionDial === null) return null;
  if (frictionDial <= 2) return "calm";
  if (frictionDial === 3) return "moderate";
  return "active";
}

let _candidateCache: { rows: CandidateRow[]; fetchedAt: number } | null = null;
const CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Invalidate the cache — call this after a Notion sync. */
export function invalidateCandidateCache(): void {
  _candidateCache = null;
}

/**
 * Fetch all ready public playdates LEFT JOINed to their materials.
 * Returns one row per playdate-material pair (playdates with no materials
 * appear once with null material columns).
 *
 * Results are cached in-memory for 5 minutes.
 */
export async function getCandidateRows(): Promise<CandidateRow[]> {
  if (_candidateCache && Date.now() - _candidateCache.fetchedAt < CANDIDATE_CACHE_TTL_MS) {
    return _candidateCache.rows;
  }

  const result = await sql.query(
    `SELECT
       p.id, p.slug, p.title, p.headline,
       p.primary_function, p.arc_emphasis, p.context_tags,
       p.friction_dial, p.start_in_120s,
       p.required_forms, p.slots_optional,
       p.find_again_mode, p.substitutions_notes,
       m.id   AS material_id,
       m.title AS material_title,
       m.form_primary AS material_form_primary
     FROM playdates_cache p
     LEFT JOIN playdate_materials pm ON pm.playdate_id = p.id
     LEFT JOIN materials_cache m ON m.id = pm.material_id AND m.do_not_use = false
     WHERE p.status = 'ready'
       AND p.release_channel IN ('sampler', 'pack-only')
     ORDER BY p.id, m.title`,
  );

  const rows = result.rows as CandidateRow[];
  _candidateCache = { rows, fetchedAt: Date.now() };
  return rows;
}

/** Group flat candidate rows into playdate objects with material arrays. */
export function groupCandidates(rows: CandidateRow[]): PlaydateCandidate[] {
  const map = new Map<string, PlaydateCandidate>();

  for (const row of rows) {
    let playdate = map.get(row.id);
    if (!playdate) {
      playdate = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        headline: row.headline,
        primaryFunction: row.primary_function,
        arcEmphasis: Array.isArray(row.arc_emphasis) ? row.arc_emphasis : [],
        contextTags: Array.isArray(row.context_tags) ? row.context_tags : [],
        frictionDial: row.friction_dial,
        energyLevel: getEnergyLevel(row.friction_dial),
        startIn120s: row.start_in_120s,
        requiredForms: Array.isArray(row.required_forms) ? row.required_forms : [],
        slotsOptional: Array.isArray(row.slots_optional) ? row.slots_optional : [],
        findAgainMode: row.find_again_mode,
        substitutionsNotes: row.substitutions_notes,
        materials: [],
      };
      map.set(row.id, playdate);
    }

    if (row.material_id) {
      playdate.materials.push({
        id: row.material_id,
        title: row.material_title!,
        formPrimary: row.material_form_primary!,
      });
    }
  }

  return Array.from(map.values());
}

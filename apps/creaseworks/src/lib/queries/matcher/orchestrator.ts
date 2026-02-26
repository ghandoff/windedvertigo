/**
 * Main orchestrator for the matcher algorithm.
 *
 * Strategy: fetch all ready playdates with their materials in a single query,
 * then score and rank in TypeScript. Batch queries for entitlements and pack
 * slugs to avoid N+1.
 */

import { sql } from "@/lib/db";
import { MatcherInput, RankedPlaydate, MatcherResult, SessionSlice } from "./types";
import { getCandidateRows, groupCandidates } from "./candidate-cache";
import { scorePlaydate } from "./scoring";

/**
 * For a set of playdate IDs, return the set of IDs that the user's org
 * is entitled to (via any pack that contains the playdate).
 */
async function batchCheckEntitlements(
  orgId: string | null,
  playdateIds: string[],
): Promise<Set<string>> {
  if (!orgId || playdateIds.length === 0) return new Set();

  const result = await sql.query(
    `SELECT DISTINCT pp.playdate_id
     FROM pack_playdates pp
     JOIN entitlements e ON e.pack_cache_id = pp.pack_id
     WHERE e.org_id = $1
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       AND pp.playdate_id = ANY($2::uuid[])`,
    [orgId, playdateIds],
  );

  return new Set(result.rows.map((r: any) => r.playdate_id));
}

/**
 * For a set of playdate IDs, return a map of playdateId → pack slugs.
 */
async function batchGetPackSlugs(
  playdateIds: string[],
): Promise<Map<string, string[]>> {
  if (playdateIds.length === 0) return new Map();

  const result = await sql.query(
    `SELECT pp.playdate_id, pc.slug
     FROM pack_playdates pp
     JOIN packs_cache pc ON pc.id = pp.pack_id
     WHERE pc.status = 'ready'
       AND pp.playdate_id = ANY($1::uuid[])
     ORDER BY pp.playdate_id, pc.slug`,
    [playdateIds],
  );

  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const list = map.get(row.playdate_id) ?? [];
    list.push(row.slug);
    map.set(row.playdate_id, list);
  }
  return map;
}

/**
 * Run the full matcher algorithm.
 *
 * 1. Fetch all ready playdates with materials (single query).
 * 2. Hard-filter by user context constraints.
 * 3. Score each surviving playdate.
 * 4. Generate substitution suggestions.
 * 5. Batch-check entitlements (if authenticated).
 * 6. Batch-fetch pack slugs.
 * 7. Sort: score DESC → friction ASC → title ASC.
 */
export async function performMatching(
  input: MatcherInput,
  session: SessionSlice | null,
): Promise<MatcherResult> {
  // 1. fetch candidates
  const rows = await getCandidateRows();
  const candidates = groupCandidates(rows);
  const totalCandidates = candidates.length;

  // 2. hard filter: context constraints and energy level
  const userContexts = input.contexts;
  const userEnergyLevels = input.energyLevels ?? [];

  const filtered = candidates.filter((p) => {
    // context constraint: all user contexts must be present
    if (userContexts.length > 0 && !userContexts.every((ctx) => p.contextTags.includes(ctx))) {
      return false;
    }
    // energy level constraint: playdate energy must match one of user's selections
    if (userEnergyLevels.length > 0 && !userEnergyLevels.includes(p.energyLevel ?? "")) {
      return false;
    }
    return true;
  });

  // build lookup sets
  const userMaterialIds = new Set(input.materials);
  const userForms = new Set(input.forms);
  const userSlots = new Set(input.slots);

  // build a map of user material id → { title, formPrimary } for substitution suggestions
  // we need to resolve titles for user materials — pull from candidate materials
  const allMaterialsMap = new Map<string, { id: string; title: string; formPrimary: string }>();
  for (const playdate of candidates) {
    for (const mat of playdate.materials) {
      allMaterialsMap.set(mat.id, mat);
    }
  }

  // user's materials with form info
  const userMaterialsByForm = new Map<string, { id: string; title: string }[]>();
  for (const matId of input.materials) {
    const mat = allMaterialsMap.get(matId);
    if (mat) {
      const list = userMaterialsByForm.get(mat.formPrimary) ?? [];
      list.push({ id: mat.id, title: mat.title });
      userMaterialsByForm.set(mat.formPrimary, list);
    }
  }

  // 3. score each playdate
  const scored = filtered.map((playdate) => {
    const { score, coverage } = scorePlaydate(
      playdate,
      userMaterialIds,
      userForms,
      userSlots,
    );

    // 4. generate substitution suggestions for missing materials
    for (const missing of coverage.materialsMissing) {
      const alternatives = userMaterialsByForm.get(missing.formPrimary);
      if (alternatives && alternatives.length > 0) {
        // exclude the missing material itself from alternatives
        const filtered = alternatives.filter((a) => a.id !== missing.id);
        if (filtered.length > 0) {
          coverage.suggestedSubstitutions.push({
            missingMaterial: missing.title,
            availableAlternatives: filtered,
          });
        }
      }
    }

    return { playdate, score, coverage };
  });

  // 5. batch entitlement check
  const playdateIds = scored.map((s) => s.playdate.id);
  const entitledIds = await batchCheckEntitlements(
    session?.orgId ?? null,
    playdateIds,
  );

  // 6. batch pack slugs
  const packSlugsMap = await batchGetPackSlugs(playdateIds);

  // 7. assemble and sort
  const ranked: RankedPlaydate[] = scored
    .map((s) => {
      const isEntitled = entitledIds.has(s.playdate.id);
      return {
        playdateId: s.playdate.id,
        slug: s.playdate.slug,
        title: s.playdate.title,
        headline: s.playdate.headline,
        score: s.score,
        primaryFunction: s.playdate.primaryFunction,
        arcEmphasis: s.playdate.arcEmphasis,
        frictionDial: s.playdate.frictionDial,
        energyLevel: s.playdate.energyLevel,
        startIn120s: s.playdate.startIn120s,
        coverage: s.coverage,
        substitutionsNotes: isEntitled ? s.playdate.substitutionsNotes : null,
        hasFindAgain: s.playdate.findAgainMode != null,
        findAgainMode: isEntitled ? s.playdate.findAgainMode : null,
        isEntitled,
        packSlugs: packSlugsMap.get(s.playdate.id) ?? [],
      };
    })
    .sort((a, b) => {
      // score descending
      if (b.score !== a.score) return b.score - a.score;
      // friction ascending (nulls last)
      const fa = a.frictionDial ?? 6;
      const fb = b.frictionDial ?? 6;
      if (fa !== fb) return fa - fb;
      // title ascending
      return a.title.localeCompare(b.title);
    });

  return {
    ranked,
    meta: {
      contextFiltersApplied: userContexts,
      energyLevelFiltersApplied: userEnergyLevels,
      totalCandidates,
      totalAfterFilter: filtered.length,
    },
  };
}

/**
 * Matcher algorithm — queries, scoring, and ranking.
 *
 * MVP 3 — pattern matcher.
 *
 * Strategy: fetch all ready patterns with their materials in a single query,
 * then score and rank in TypeScript. Batch queries for entitlements and pack
 * slugs to avoid N+1.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface MatcherInput {
  materials: string[];   // material UUIDs the user has on hand
  forms: string[];       // required form values they can provide
  slots: string[];       // optional slot tags
  contexts: string[];    // context constraint tags
}

interface CoverageDetail {
  materialsCovered: { id: string; title: string }[];
  materialsMissing: { id: string; title: string; formPrimary: string }[];
  formsCovered: string[];
  formsMissing: string[];
  suggestedSubstitutions: {
    missingMaterial: string;
    availableAlternatives: { id: string; title: string }[];
  }[];
}

export interface RankedPattern {
  patternId: string;
  slug: string;
  title: string;
  headline: string | null;
  score: number;
  primaryFunction: string | null;
  arcEmphasis: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  coverage: CoverageDetail;
  substitutionsNotes: string | null;
  hasFindAgain: boolean;
  findAgainMode: string | null;
  isEntitled: boolean;
  packSlugs: string[];
}

export interface MatcherResult {
  ranked: RankedPattern[];
  meta: {
    contextFiltersApplied: string[];
    totalCandidates: number;
    totalAfterFilter: number;
  };
}

/* ------------------------------------------------------------------ */
/*  picker data queries (used by the server page to populate the form) */
/* ------------------------------------------------------------------ */

/** Distinct required_forms values across all ready public patterns. */
export async function getDistinctForms(): Promise<string[]> {
  const result = await sql.query(
    `SELECT DISTINCT val AS form
     FROM patterns_cache,
          jsonb_array_elements_text(required_forms) AS val
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY form ASC`,
  );
  return result.rows.map((r: any) => r.form);
}

/** Distinct slots_optional values across all ready public patterns. */
export async function getDistinctSlots(): Promise<string[]> {
  const result = await sql.query(
    `SELECT DISTINCT val AS slot
     FROM patterns_cache,
          jsonb_array_elements_text(slots_optional) AS val
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY slot ASC`,
  );
  return result.rows.map((r: any) => r.slot);
}

/** Distinct context_tags values across all ready public patterns. */
export async function getDistinctContexts(): Promise<string[]> {
  const result = await sql.query(
    `SELECT DISTINCT val AS context
     FROM patterns_cache,
          jsonb_array_elements_text(context_tags) AS val
     WHERE status = 'ready'
       AND release_channel IN ('sampler', 'pack-only')
     ORDER BY context ASC`,
  );
  return result.rows.map((r: any) => r.context);
}

/* ------------------------------------------------------------------ */
/*  candidate query                                                    */
/* ------------------------------------------------------------------ */

interface CandidateRow {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  arc_emphasis: string[];
  context_tags: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  required_forms: string[];
  slots_optional: string[];
  find_again_mode: string | null;
  substitutions_notes: string | null;
  // joined material fields (null when pattern has no materials)
  material_id: string | null;
  material_title: string | null;
  material_form_primary: string | null;
}

/**
 * In-memory cache for candidate rows. Patterns only change when the
 * Notion sync runs (at most once per hour via cron), so a 5-minute
 * TTL eliminates redundant full-table scans while staying fresh.
 *
 * Audit fix #10: getCandidateRows() did a full table scan on every
 * matcher request with no caching.
 */
let _candidateCache: { rows: CandidateRow[]; fetchedAt: number } | null = null;
const CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Invalidate the cache — call this after a Notion sync. */
export function invalidateCandidateCache(): void {
  _candidateCache = null;
}

/**
 * Fetch all ready public patterns LEFT JOINed to their materials.
 * Returns one row per pattern–material pair (patterns with no materials
 * appear once with null material columns).
 *
 * Results are cached in-memory for 5 minutes.
 */
async function getCandidateRows(): Promise<CandidateRow[]> {
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
     FROM patterns_cache p
     LEFT JOIN pattern_materials pm ON pm.pattern_id = p.id
     LEFT JOIN materials_cache m ON m.id = pm.material_id AND m.do_not_use = false
     WHERE p.status = 'ready'
       AND p.release_channel IN ('sampler', 'pack-only')
     ORDER BY p.id, m.title`,
  );

  const rows = result.rows as CandidateRow[];
  _candidateCache = { rows, fetchedAt: Date.now() };
  return rows;
}

interface PatternCandidate {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primaryFunction: string | null;
  arcEmphasis: string[];
  contextTags: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  requiredForms: string[];
  slotsOptional: string[];
  findAgainMode: string | null;
  substitutionsNotes: string | null;
  materials: { id: string; title: string; formPrimary: string }[];
}

/** Group flat candidate rows into pattern objects with material arrays. */
function groupCandidates(rows: CandidateRow[]): PatternCandidate[] {
  const map = new Map<string, PatternCandidate>();

  for (const row of rows) {
    let pattern = map.get(row.id);
    if (!pattern) {
      pattern = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        headline: row.headline,
        primaryFunction: row.primary_function,
        arcEmphasis: Array.isArray(row.arc_emphasis) ? row.arc_emphasis : [],
        contextTags: Array.isArray(row.context_tags) ? row.context_tags : [],
        frictionDial: row.friction_dial,
        startIn120s: row.start_in_120s,
        requiredForms: Array.isArray(row.required_forms) ? row.required_forms : [],
        slotsOptional: Array.isArray(row.slots_optional) ? row.slots_optional : [],
        findAgainMode: row.find_again_mode,
        substitutionsNotes: row.substitutions_notes,
        materials: [],
      };
      map.set(row.id, pattern);
    }

    if (row.material_id) {
      pattern.materials.push({
        id: row.material_id,
        title: row.material_title!,
        formPrimary: row.material_form_primary!,
      });
    }
  }

  return Array.from(map.values());
}

/* ------------------------------------------------------------------ */
/*  batch queries for entitlements and pack slugs                      */
/* ------------------------------------------------------------------ */

/**
 * For a set of pattern IDs, return the set of IDs that the user's org
 * is entitled to (via any pack that contains the pattern).
 */
async function batchCheckEntitlements(
  orgId: string | null,
  patternIds: string[],
): Promise<Set<string>> {
  if (!orgId || patternIds.length === 0) return new Set();

  const result = await sql.query(
    `SELECT DISTINCT pp.pattern_id
     FROM pack_patterns pp
     JOIN entitlements e ON e.pack_cache_id = pp.pack_id
     WHERE e.org_id = $1
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       AND pp.pattern_id = ANY($2::uuid[])`,
    [orgId, patternIds],
  );

  return new Set(result.rows.map((r: any) => r.pattern_id));
}

/**
 * For a set of pattern IDs, return a map of patternId → pack slugs.
 */
async function batchGetPackSlugs(
  patternIds: string[],
): Promise<Map<string, string[]>> {
  if (patternIds.length === 0) return new Map();

  const result = await sql.query(
    `SELECT pp.pattern_id, pc.slug
     FROM pack_patterns pp
     JOIN packs_cache pc ON pc.id = pp.pack_id
     WHERE pc.status = 'ready'
       AND pp.pattern_id = ANY($1::uuid[])
     ORDER BY pp.pattern_id, pc.slug`,
    [patternIds],
  );

  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const list = map.get(row.pattern_id) ?? [];
    list.push(row.slug);
    map.set(row.pattern_id, list);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  scoring                                                            */
/* ------------------------------------------------------------------ */

function scorePattern(
  pattern: PatternCandidate,
  userMaterialIds: Set<string>,
  userForms: Set<string>,
  userSlots: Set<string>,
): { score: number; coverage: CoverageDetail } {
  // --- materials coverage (0–45) ---
  const materialsCovered: { id: string; title: string }[] = [];
  const materialsMissing: { id: string; title: string; formPrimary: string }[] = [];

  for (const mat of pattern.materials) {
    if (userMaterialIds.has(mat.id)) {
      materialsCovered.push({ id: mat.id, title: mat.title });
    } else {
      materialsMissing.push({ id: mat.id, title: mat.title, formPrimary: mat.formPrimary });
    }
  }

  const materialsRatio =
    pattern.materials.length === 0
      ? 1.0
      : materialsCovered.length / pattern.materials.length;
  const materialsScore = materialsRatio * 45;

  // --- forms coverage (0–30) ---
  const formsCovered: string[] = [];
  const formsMissing: string[] = [];

  for (const form of pattern.requiredForms) {
    if (userForms.has(form)) {
      formsCovered.push(form);
    } else {
      formsMissing.push(form);
    }
  }

  const formsRatio =
    pattern.requiredForms.length === 0
      ? 1.0
      : formsCovered.length / pattern.requiredForms.length;
  const formsScore = formsRatio * 30;

  // --- slots match bonus (0–10) ---
  let slotsScore: number;
  if (userSlots.size === 0) {
    slotsScore = 10; // no preference = no penalty
  } else {
    const slotsOverlap = pattern.slotsOptional.filter((s) => userSlots.has(s));
    const slotDenom = Math.max(pattern.slotsOptional.length, 1);
    slotsScore = (slotsOverlap.length / slotDenom) * 10;
  }

  // --- quick-start bonus (0–10) ---
  const quickStartScore = pattern.startIn120s ? 10 : 0;

  // --- friction penalty (0–5 deduction) ---
  const frictionPenalty = pattern.frictionDial ? pattern.frictionDial - 1 : 0;

  const score = Math.round(
    materialsScore + formsScore + slotsScore + quickStartScore - frictionPenalty,
  );

  // --- substitution suggestions ---
  // for each missing material, find user materials with the same form_primary
  const suggestedSubstitutions: CoverageDetail["suggestedSubstitutions"] = [];
  // (filled in by the caller who has access to the user's full material list)

  return {
    score: Math.max(0, Math.min(100, score)),
    coverage: {
      materialsCovered,
      materialsMissing,
      formsCovered,
      formsMissing,
      suggestedSubstitutions,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  main orchestrator                                                  */
/* ------------------------------------------------------------------ */

interface SessionSlice {
  orgId: string | null;
}

/**
 * Run the full matcher algorithm.
 *
 * 1. Fetch all ready patterns with materials (single query).
 * 2. Hard-filter by user context constraints.
 * 3. Score each surviving pattern.
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

  // 2. hard filter: context constraints
  const userContexts = input.contexts;
  const filtered = userContexts.length > 0
    ? candidates.filter((p) =>
        userContexts.every((ctx) => p.contextTags.includes(ctx)),
      )
    : candidates;

  // build lookup sets
  const userMaterialIds = new Set(input.materials);
  const userForms = new Set(input.forms);
  const userSlots = new Set(input.slots);

  // build a map of user material id → { title, formPrimary } for substitution suggestions
  // we need to resolve titles for user materials — pull from candidate materials
  const allMaterialsMap = new Map<string, { id: string; title: string; formPrimary: string }>();
  for (const pattern of candidates) {
    for (const mat of pattern.materials) {
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

  // 3. score each pattern
  const scored = filtered.map((pattern) => {
    const { score, coverage } = scorePattern(
      pattern,
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

    return { pattern, score, coverage };
  });

  // 5. batch entitlement check
  const patternIds = scored.map((s) => s.pattern.id);
  const entitledIds = await batchCheckEntitlements(
    session?.orgId ?? null,
    patternIds,
  );

  // 6. batch pack slugs
  const packSlugsMap = await batchGetPackSlugs(patternIds);

  // 7. assemble and sort
  const ranked: RankedPattern[] = scored
    .map((s) => {
      const isEntitled = entitledIds.has(s.pattern.id);
      return {
        patternId: s.pattern.id,
        slug: s.pattern.slug,
        title: s.pattern.title,
        headline: s.pattern.headline,
        score: s.score,
        primaryFunction: s.pattern.primaryFunction,
        arcEmphasis: s.pattern.arcEmphasis,
        frictionDial: s.pattern.frictionDial,
        startIn120s: s.pattern.startIn120s,
        coverage: s.coverage,
        substitutionsNotes: isEntitled ? s.pattern.substitutionsNotes : null,
        hasFindAgain: s.pattern.findAgainMode != null,
        findAgainMode: isEntitled ? s.pattern.findAgainMode : null,
        isEntitled,
        packSlugs: packSlugsMap.get(s.pattern.id) ?? [],
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
      totalCandidates,
      totalAfterFilter: filtered.length,
    },
  };
}

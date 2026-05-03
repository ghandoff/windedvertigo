/**
 * PCS Controlled Vocabulary readers (Bundle 4 Phase 1).
 *
 * Read-only access to the 11 `cv_*` tables that live in the wv-nordic Supabase
 * project. The tables were seeded 2026-04-16 from Lauren Bosio's vocabulary
 * doc and are documented in `db/migrations/003_aics_entity_ddl.sql` (the
 * source of truth — note: file expected to land alongside Phase 4.2).
 *
 * IMPORTANT — current implementation: this codebase is Notion-primary and
 * does not yet have a Postgres connection helper (no `@neondatabase/serverless`
 * or `@vercel/postgres` in package.json as of 2026-05-03). The seeded enum
 * tables are small (<20 rows) and stable per Lauren's spec, so we ship the
 * values inline as module-scoped constants. This unblocks the PCS form
 * scaffold (Phase 1) without forcing the Postgres dependency in until Phase
 * 4.2 actually needs writes.
 *
 * TODO Phase 4.2 — replace the inline constants with `SELECT … FROM cv_*`
 * reads against Supabase. The exported helper signatures must remain stable
 * so the UI does not change.
 */

// ─── cv_format_codes ────────────────────────────────────────────────────────
const FORMAT_CODES = Object.freeze([
  { code: 'CAP',  displayName: 'Capsule',  sortOrder: 10 },
  { code: 'CHW',  displayName: 'Chewable', sortOrder: 20 },
  { code: 'GUM',  displayName: 'Gummy',    sortOrder: 30 },
  { code: 'LIQ',  displayName: 'Liquid',   sortOrder: 40 },
  { code: 'SG',   displayName: 'Softgel',  sortOrder: 50 },
  { code: 'TAB',  displayName: 'Tablet',   sortOrder: 60 },
  { code: 'PWDR', displayName: 'Powder',   sortOrder: 70 },
]);

// ─── cv_demographics_age ────────────────────────────────────────────────────
const DEMOGRAPHICS_AGE = Object.freeze([
  { code: 'infants',         displayName: 'Infants (0-12mo)',     ageMinYears: 0,  ageMaxYears: 1,   sortOrder: 10 },
  { code: 'children_1_3',    displayName: 'Children (1-3y)',      ageMinYears: 1,  ageMaxYears: 3,   sortOrder: 20 },
  { code: 'children_4_12',   displayName: 'Children (4-12y)',     ageMinYears: 4,  ageMaxYears: 12,  sortOrder: 30 },
  { code: 'teens_13_17',     displayName: 'Teens (13-17y)',       ageMinYears: 13, ageMaxYears: 17,  sortOrder: 40 },
  { code: 'adults_18_69',    displayName: 'Adults (18-69y)',      ageMinYears: 18, ageMaxYears: 69,  sortOrder: 50 },
  { code: 'older_adults',    displayName: 'Older adults (70+y)',  ageMinYears: 70, ageMaxYears: 120, sortOrder: 60 },
]);

// ─── cv_demographics_sex ────────────────────────────────────────────────────
const DEMOGRAPHICS_SEX = Object.freeze([
  { code: 'female',  displayName: 'Female',                  sortOrder: 10 },
  { code: 'male',    displayName: 'Male',                    sortOrder: 20 },
  { code: 'all',     displayName: 'All / not sex-specific',  sortOrder: 30 },
]);

// ─── cv_demographics_lifestage ──────────────────────────────────────────────
const DEMOGRAPHICS_LIFESTAGE = Object.freeze([
  { code: 'general',    displayName: 'General',                sortOrder: 10 },
  { code: 'pregnant',   displayName: 'Pregnant',               sortOrder: 20 },
  { code: 'lactating',  displayName: 'Lactating',              sortOrder: 30 },
  { code: 'menopause',  displayName: 'Peri/post-menopause',    sortOrder: 40 },
]);

// ─── cv_demographics_lifestyle ──────────────────────────────────────────────
const DEMOGRAPHICS_LIFESTYLE = Object.freeze([
  { code: 'general',  displayName: 'General',          sortOrder: 10 },
  { code: 'athlete',  displayName: 'Athletic / active', sortOrder: 20 },
  { code: 'vegan',    displayName: 'Vegan / vegetarian', sortOrder: 30 },
]);

// ─── cv_benefit_categories (17 rows per Lauren 2026-04-16) ──────────────────
const BENEFIT_CATEGORIES = Object.freeze([
  { code: 'cardiovascular',    displayName: 'Cardiovascular health',     sortOrder: 10 },
  { code: 'cognitive',         displayName: 'Cognitive / brain',         sortOrder: 20 },
  { code: 'mood_stress',       displayName: 'Mood & stress',             sortOrder: 30 },
  { code: 'sleep',             displayName: 'Sleep',                     sortOrder: 40 },
  { code: 'immune',            displayName: 'Immune support',            sortOrder: 50 },
  { code: 'gi_digestive',      displayName: 'GI / digestive',            sortOrder: 60 },
  { code: 'metabolic',         displayName: 'Metabolic / blood sugar',   sortOrder: 70 },
  { code: 'weight_management', displayName: 'Weight management',         sortOrder: 80 },
  { code: 'bone_joint',        displayName: 'Bone & joint',              sortOrder: 90 },
  { code: 'muscle_recovery',   displayName: 'Muscle / recovery',         sortOrder: 100 },
  { code: 'energy',            displayName: 'Energy & vitality',         sortOrder: 110 },
  { code: 'eye_vision',        displayName: 'Eye / vision',              sortOrder: 120 },
  { code: 'skin_hair_nails',   displayName: 'Skin, hair & nails',        sortOrder: 130 },
  { code: 'reproductive',      displayName: 'Reproductive / hormonal',   sortOrder: 140 },
  { code: 'prenatal',          displayName: 'Prenatal / pregnancy',      sortOrder: 150 },
  { code: 'pediatric',         displayName: 'Pediatric',                 sortOrder: 160 },
  { code: 'general_wellness',  displayName: 'General wellness',          sortOrder: 170 },
]);

// ─── cv_claim_grades ────────────────────────────────────────────────────────
const CLAIM_GRADES = Object.freeze([
  { code: 'A', displayName: 'Grade A — High-quality evidence',    sortOrder: 10 },
  { code: 'B', displayName: 'Grade B — Moderate evidence',        sortOrder: 20 },
  { code: 'C', displayName: 'Grade C — Limited / mechanistic',    sortOrder: 30 },
]);

// ─── Empty CV tables (populated in later phases) ────────────────────────────
// cv_active_ingredients — populated via Lauren's Smartsheet import (Phase 4.2+).
const ACTIVE_INGREDIENTS = Object.freeze([]);
// cv_ai_forms — populated when AICS docs land. Filtered by AI selection.
const AI_FORMS = Object.freeze([]);
// cv_ai_sources — populated when AICS docs land.
const AI_SOURCES = Object.freeze([]);
// cv_claim_prefixes — placeholder; Lauren's prefix CSV pending.
const CLAIM_PREFIXES = Object.freeze([]);

// ─── Public read-only helpers ──────────────────────────────────────────────
// All return shallow copies so callers can sort/filter without polluting the
// frozen module-level constants. TODO Phase 4.2 — swap each body for the
// corresponding `SELECT * FROM cv_*` against Supabase (use connection-
// pooling pattern still to be established).

export function getFormatCodes() {
  return FORMAT_CODES.map((row) => ({ ...row }));
}

export function getDemographicsAge() {
  return DEMOGRAPHICS_AGE.map((row) => ({ ...row }));
}

export function getDemographicsSex() {
  return DEMOGRAPHICS_SEX.map((row) => ({ ...row }));
}

export function getDemographicsLifestage() {
  return DEMOGRAPHICS_LIFESTAGE.map((row) => ({ ...row }));
}

export function getDemographicsLifestyle() {
  return DEMOGRAPHICS_LIFESTYLE.map((row) => ({ ...row }));
}

export function getBenefitCategories() {
  return BENEFIT_CATEGORIES.map((row) => ({ ...row }));
}

export function getClaimGrades() {
  return CLAIM_GRADES.map((row) => ({ ...row }));
}

export function getActiveIngredients() {
  return ACTIVE_INGREDIENTS.map((row) => ({ ...row }));
}

/**
 * Filtered AI forms by parent active ingredient.
 * @param {string} [_activeIngredientId] — unused until cv_ai_forms is seeded.
 */
export function getAiForms(_activeIngredientId) {
  // TODO Phase 4.2 — `WHERE active_ingredient_id = $1` once cv_ai_forms is seeded.
  return AI_FORMS.map((row) => ({ ...row }));
}

export function getAiSources() {
  return AI_SOURCES.map((row) => ({ ...row }));
}

export function getClaimPrefixes() {
  return CLAIM_PREFIXES.map((row) => ({ ...row }));
}

/**
 * Bundle helper used by the GET /api/pcs/cv route — single payload the form
 * mounts once. Keys mirror the helper names for predictable consumption.
 */
export function getControlledVocabBundle() {
  return {
    formatCodes:           getFormatCodes(),
    demographicsAge:       getDemographicsAge(),
    demographicsSex:       getDemographicsSex(),
    demographicsLifestage: getDemographicsLifestage(),
    demographicsLifestyle: getDemographicsLifestyle(),
    benefitCategories:     getBenefitCategories(),
    claimGrades:           getClaimGrades(),
    activeIngredients:     getActiveIngredients(),
    aiForms:               getAiForms(),
    aiSources:             getAiSources(),
    claimPrefixes:         getClaimPrefixes(),
  };
}

// AI unit dropdown for dose entry. Not a cv_* table — this is the static
// list Lauren confirmed for the form-driven path.
export const AI_UNIT_OPTIONS = Object.freeze(['mcg', 'mg', 'IU', '%DV']);

/**
 * Canonical-claim identity key builder.
 *
 * Wave 7.0.5 T2 — added 2026-04-21.
 *
 * Canonical-claim uniqueness is not a simple hash of prefix + benefit + AI.
 * Per Gina's 2026-04-19 review, each prefix carries a *dose sensitivity*
 * that determines whether dose is part of the claim's identity:
 *
 *   dose_gated      → dose IS part of identity (e.g. "Supports normal mood
 *                     at 100mg" and "at 600mg" are two distinct canonical
 *                     claims because RCT evidence is dose-tiered).
 *   dose_agnostic   → dose IRRELEVANT to identity (e.g. "Required for normal
 *                     bone health" — a mechanistic/essentiality framing that
 *                     holds across doses).
 *   dose_qualified  → dose IS part of identity, AND the fact that the
 *                     qualifier prefix was used is also part of identity.
 *                     Treated like dose_gated for dose inclusion, but the
 *                     'dose_qualified' sensitivity tag is baked into the key
 *                     so a 500mg "Supports…" and a 500mg "Provides
 *                     nutritional support for…" claim do NOT collide.
 *   not_applicable  → treated like dose_agnostic (omit dose from key).
 *
 * The key is a deterministic string so Notion `rich_text contains` filters
 * can be used for dedup lookup. Demographic axes are normalized (trim +
 * lowercase) and sorted alphabetically for stable ordering.
 *
 * Pure-function module — no Notion calls here; callers resolve the prefix's
 * dose sensitivity via `src/lib/pcs-prefixes.js` and pass it in.
 */

export const DOSE_SENSITIVITY = Object.freeze({
  GATED: 'dose_gated',
  AGNOSTIC: 'dose_agnostic',
  QUALIFIED: 'dose_qualified',
  NOT_APPLICABLE: 'not_applicable',
});

const VALID_SENSITIVITIES = new Set(Object.values(DOSE_SENSITIVITY));

/**
 * Normalize a single demographic axis value into `axis:value` tokens.
 * Accepts strings, arrays of strings, or null/undefined.
 */
function tokenizeAxis(axis, rawValue) {
  if (rawValue == null) return [];
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  return values
    .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .filter(Boolean)
    .map((v) => `${axis}=${v}`);
}

/**
 * Normalize a demographics bundle into a sorted, deterministic string.
 *
 * `demographicAxes` may be an object keyed by axis name — biologicalSex,
 * ageGroup, lifeStage, lifestyle — or an array of pre-formatted tokens.
 * Empty/nullish → empty string (omitted from key).
 */
function normalizeDemographics(demographicAxes) {
  if (!demographicAxes) return '';
  let tokens = [];
  if (Array.isArray(demographicAxes)) {
    tokens = demographicAxes
      .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter(Boolean);
  } else if (typeof demographicAxes === 'object') {
    for (const [axis, value] of Object.entries(demographicAxes)) {
      tokens.push(...tokenizeAxis(axis, value));
    }
  }
  return tokens.sort().join(',');
}

/**
 * Normalize a Notion page id to its canonical dashless-32 hex form.
 * Returns empty string for null/undefined/empty so keys are stable.
 */
function normId(id) {
  if (!id || typeof id !== 'string') return '';
  return id.replace(/-/g, '').toLowerCase();
}

/**
 * Compute the deterministic canonical-claim key.
 *
 * Shape: `v1:{prefix}:{coreBenefit}:{ai}:{aiForm}:{sensitivity}:{dose}:{demographics}`
 *
 * Fields we cannot populate render as empty between colons, so the
 * positional shape is stable across partial inputs.
 *
 * @param {object} spec
 * @param {string|null} spec.prefixId
 * @param {string} spec.prefixDoseSensitivity — one of DOSE_SENSITIVITY values
 * @param {string|null} [spec.coreBenefitId]
 * @param {string|null} [spec.activeIngredientId]
 * @param {string|null} [spec.activeIngredientFormId]
 * @param {number|null} [spec.dose]      — numeric dose; omitted when agnostic
 * @param {string|null} [spec.doseUnit]  — e.g. 'mg', 'mcg'
 * @param {object|array|null} [spec.demographicAxes]
 */
export function computeCanonicalClaimKey(spec = {}) {
  const {
    prefixId = null,
    prefixDoseSensitivity,
    coreBenefitId = null,
    activeIngredientId = null,
    activeIngredientFormId = null,
    dose = null,
    doseUnit = null,
    demographicAxes = null,
  } = spec;

  const sensitivity = VALID_SENSITIVITIES.has(prefixDoseSensitivity)
    ? prefixDoseSensitivity
    : DOSE_SENSITIVITY.NOT_APPLICABLE;

  // Dose is part of identity only when the prefix is dose_gated or
  // dose_qualified. For dose_qualified, we also bake the sensitivity token
  // into the key so a dose_gated 500mg claim and a dose_qualified 500mg
  // claim do not collide.
  const includeDose =
    sensitivity === DOSE_SENSITIVITY.GATED ||
    sensitivity === DOSE_SENSITIVITY.QUALIFIED;

  let doseToken = '';
  if (includeDose && dose != null && Number.isFinite(Number(dose))) {
    const unit = (typeof doseUnit === 'string' ? doseUnit.trim().toLowerCase() : '') || 'mg';
    doseToken = `${Number(dose)}${unit}`;
  }

  const demographicsToken = normalizeDemographics(demographicAxes);

  return [
    'v1',
    normId(prefixId),
    normId(coreBenefitId),
    normId(activeIngredientId),
    normId(activeIngredientFormId),
    sensitivity,
    doseToken,
    demographicsToken,
  ].join(':');
}

/**
 * Deep equality on canonical-claim specs via the key function.
 * Useful for in-memory dedup during backfill.
 */
export function canonicalClaimsEqual(a, b) {
  return computeCanonicalClaimKey(a || {}) === computeCanonicalClaimKey(b || {});
}

/**
 * Normalize a raw Notion select name into a DOSE_SENSITIVITY value.
 * Unknown/null → NOT_APPLICABLE (conservative: dose excluded from key).
 */
export function coerceDoseSensitivity(value) {
  if (typeof value === 'string' && VALID_SENSITIVITIES.has(value)) {
    return value;
  }
  return DOSE_SENSITIVITY.NOT_APPLICABLE;
}

#!/usr/bin/env node
/**
 * Verification harness for src/lib/pcs-controlled-vocab.js (Bundle 4 Phase 1).
 *
 * Asserts that the read helpers return the row counts Lauren's 2026-04-16
 * vocab doc seeded into the cv_* tables. The helpers currently back onto
 * frozen module-scope constants (no Postgres helper exists in this repo
 * yet — see TODO Phase 4.2 in the source). When the real DB read replaces
 * the constants, these tests should continue to pass against the seeded data.
 *
 * Usage:
 *   node tests/controlled-vocab.verify.mjs
 */

import {
  getFormatCodes,
  getDemographicsAge,
  getDemographicsSex,
  getDemographicsLifestage,
  getDemographicsLifestyle,
  getBenefitCategories,
  getClaimGrades,
  getActiveIngredients,
  getAiForms,
  getAiSources,
  getClaimPrefixes,
  getControlledVocabBundle,
  AI_UNIT_OPTIONS,
} from '../src/lib/pcs-controlled-vocab.js';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) { tests.push({ name, fn }); }
function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertion'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(v, msg) { assertEq(v, true, msg); }

// ─── Row counts (per Lauren 2026-04-16 seed) ────────────────────────────────
test('cv_format_codes returns 7 rows', () => {
  assertEq(getFormatCodes().length, 7, 'format codes count');
});

test('cv_demographics_age returns 6 rows', () => {
  assertEq(getDemographicsAge().length, 6, 'demographics age count');
});

test('cv_demographics_sex returns 3 rows', () => {
  assertEq(getDemographicsSex().length, 3, 'demographics sex count');
});

test('cv_demographics_lifestage returns 4 rows', () => {
  assertEq(getDemographicsLifestage().length, 4, 'demographics lifestage count');
});

test('cv_demographics_lifestyle returns 3 rows', () => {
  assertEq(getDemographicsLifestyle().length, 3, 'demographics lifestyle count');
});

test('cv_benefit_categories returns 17 rows', () => {
  assertEq(getBenefitCategories().length, 17, 'benefit categories count');
});

test('cv_claim_grades returns 3 rows (A/B/C)', () => {
  const grades = getClaimGrades();
  assertEq(grades.length, 3, 'claim grades count');
  const codes = grades.map((g) => g.code).sort();
  assertEq(codes.join(','), 'A,B,C', 'claim grade codes');
});

// ─── Empty CV tables (populated in later phases) ────────────────────────────
test('cv_active_ingredients returns [] until import lands', () => {
  assertEq(getActiveIngredients().length, 0, 'active ingredients (empty)');
});

test('cv_ai_forms returns [] until AICS docs land', () => {
  assertEq(getAiForms().length, 0, 'ai forms (empty)');
  assertEq(getAiForms('any-id').length, 0, 'ai forms filtered (empty)');
});

test('cv_ai_sources returns [] until AICS docs land', () => {
  assertEq(getAiSources().length, 0, 'ai sources (empty)');
});

test('cv_claim_prefixes returns [] (placeholder)', () => {
  assertEq(getClaimPrefixes().length, 0, 'claim prefixes (empty)');
});

// ─── Shape invariants ──────────────────────────────────────────────────────
test('every format-code row has code/displayName/sortOrder', () => {
  for (const row of getFormatCodes()) {
    assertTrue(typeof row.code === 'string' && row.code.length > 0, 'code is non-empty string');
    assertTrue(typeof row.displayName === 'string' && row.displayName.length > 0, 'displayName non-empty');
    assertTrue(typeof row.sortOrder === 'number', 'sortOrder is number');
  }
});

test('format codes include the 7 Lauren-spec codes', () => {
  const codes = getFormatCodes().map((r) => r.code).sort();
  assertEq(codes.join(','), 'CAP,CHW,GUM,LIQ,PWDR,SG,TAB', 'format-code identity');
});

test('demographics-age rows expose ageMinYears + ageMaxYears', () => {
  for (const row of getDemographicsAge()) {
    assertTrue(typeof row.ageMinYears === 'number', 'ageMinYears number');
    assertTrue(typeof row.ageMaxYears === 'number', 'ageMaxYears number');
    assertTrue(row.ageMinYears <= row.ageMaxYears, 'min <= max');
  }
});

test('helpers return shallow copies (mutation does not leak)', () => {
  const a = getFormatCodes();
  a[0].displayName = 'mutated';
  const b = getFormatCodes();
  assertTrue(b[0].displayName !== 'mutated', 'second read is fresh');
});

// ─── Bundle helper ─────────────────────────────────────────────────────────
test('getControlledVocabBundle aggregates all 11 CV tables', () => {
  const bundle = getControlledVocabBundle();
  const expectedKeys = [
    'formatCodes', 'demographicsAge', 'demographicsSex',
    'demographicsLifestage', 'demographicsLifestyle',
    'benefitCategories', 'claimGrades',
    'activeIngredients', 'aiForms', 'aiSources', 'claimPrefixes',
  ];
  for (const key of expectedKeys) {
    assertTrue(Array.isArray(bundle[key]), `bundle.${key} is array`);
  }
  assertEq(Object.keys(bundle).length, expectedKeys.length, 'bundle key count');
});

// ─── AI unit options ───────────────────────────────────────────────────────
test('AI_UNIT_OPTIONS exports the dose unit list (mcg/mg/IU/%DV)', () => {
  assertEq([...AI_UNIT_OPTIONS].sort().join(','), '%DV,IU,mcg,mg', 'unit options');
});

// ─── Run ───────────────────────────────────────────────────────────────────
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed (${tests.length} total)`);
process.exit(failed === 0 ? 0 : 1);

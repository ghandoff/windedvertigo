#!/usr/bin/env node
/**
 * Verification harness for CAIPB pure-logic functions.
 *
 * Covers:
 *   1. Form usage rollup — counts + percentages
 *   2. Benefit category aggregation from claim rows
 *   3. Region-aware filtering (delegates to filterByRegion contract)
 *   4. AuthorityRegionsEditor gate: only valid CLAIM_AUTHORITY_REGIONS pass
 *   5. Ingredient/product/benefit cross-link integrity
 *
 * Why inline rather than import:
 *   The CAIPB API routes import pcs-formula-lines, pcs-versions, etc., which
 *   have top-level Notion/Supabase client initialisation. Importing those in
 *   a bare Node.js test would throw. We inline the pure rollup functions here.
 *
 * Usage:
 *   node tests/caipb.verify.mjs
 */

import { CLAIM_AUTHORITY_REGIONS } from '../src/lib/pcs-config.js';

// ─── Inline pure functions mirrored from the CAIPB API routes ────────────────

/** Mirror of the form-usage rollup in /api/pcs/caipb/ingredient/[id]/route.js */
function computeFormUsage(products) {
  const formCounts = {};
  for (const p of products) {
    const form = p.aiForm || '(unknown form)';
    formCounts[form] = (formCounts[form] || 0) + 1;
  }
  const total = products.length || 1;
  return Object.entries(formCounts)
    .map(([form, count]) => ({ form, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/** Mirror of the benefit-category aggregation in /api/pcs/caipb/ingredient/[id]/route.js */
function aggregateBenefitCategories(claimRows) {
  const map = new Map();
  for (const row of claimRows) {
    if (!row.benefitCategory) continue;
    const { id, name } = row.benefitCategory;
    if (!map.has(id)) map.set(id, { id, name, claimCount: 0 });
    map.get(id).claimCount++;
  }
  return [...map.values()].sort((a, b) => b.claimCount - a.claimCount);
}

/** Mirror of filterByRegion from pcs-explorer.js */
function filterByRegion(rows, region) {
  if (!region) return rows;
  return rows.filter(row =>
    Array.isArray(row.authorityRegions) && row.authorityRegions.includes(region),
  );
}

/** Mirror of authority-regions validation from /api/pcs/claims/[id]/route.js */
function validateAuthorityRegions(regions) {
  if (!Array.isArray(regions)) return { valid: false, error: 'not an array' };
  const invalid = regions.filter(r => !CLAIM_AUTHORITY_REGIONS.includes(r));
  if (invalid.length > 0) return { valid: false, error: `unknown: ${invalid.join(', ')}` };
  return { valid: true };
}

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg ?? 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(v, msg) {
  if (!v) throw new Error(msg ?? 'Expected true, got false');
}

// ─── 1. Form usage rollup ─────────────────────────────────────────────────────
console.log('\nForm usage rollup:');

test('empty products → empty rollup', () => {
  const result = computeFormUsage([]);
  assertEqual(result.length, 0);
});

test('single form → 100%', () => {
  const products = [{ aiForm: 'Citrate' }, { aiForm: 'Citrate' }];
  const result = computeFormUsage(products);
  assertEqual(result.length, 1);
  assertEqual(result[0].form, 'Citrate');
  assertEqual(result[0].count, 2);
  assertEqual(result[0].pct, 100);
});

test('two forms → correct split', () => {
  const products = [
    { aiForm: 'Citrate' }, { aiForm: 'Citrate' }, { aiForm: 'Citrate' },
    { aiForm: 'Glycinate' },
  ];
  const result = computeFormUsage(products);
  assertEqual(result.length, 2);
  assertEqual(result[0].form, 'Citrate');
  assertEqual(result[0].pct, 75);
  assertEqual(result[1].form, 'Glycinate');
  assertEqual(result[1].pct, 25);
});

test('null aiForm treated as (unknown form)', () => {
  const products = [{ aiForm: null }, { aiForm: null }];
  const result = computeFormUsage(products);
  assertEqual(result.length, 1);
  assertEqual(result[0].form, '(unknown form)');
  assertEqual(result[0].count, 2);
});

test('sorted by count descending', () => {
  const products = [
    { aiForm: 'A' }, { aiForm: 'B' }, { aiForm: 'B' }, { aiForm: 'B' }, { aiForm: 'C' }, { aiForm: 'C' },
  ];
  const result = computeFormUsage(products);
  assertEqual(result[0].form, 'B', 'highest count first');
  assertEqual(result[1].form, 'C', 'second');
  assertEqual(result[2].form, 'A', 'third');
});

test('percentages sum to ~100 (rounding may differ by 1)', () => {
  const products = [{ aiForm: 'A' }, { aiForm: 'B' }, { aiForm: 'C' }];
  const result = computeFormUsage(products);
  const sum = result.reduce((acc, r) => acc + r.pct, 0);
  assertTrue(sum >= 99 && sum <= 101, `pct sum must be ~100, got ${sum}`);
});

// ─── 2. Benefit category aggregation ─────────────────────────────────────────
console.log('\nBenefit category aggregation:');

const EYE_HEALTH = { id: 'bc1', name: 'Eye Health' };
const BONE_HEALTH = { id: 'bc2', name: 'Bone Health' };

test('empty claim rows → empty categories', () => {
  const result = aggregateBenefitCategories([]);
  assertEqual(result.length, 0);
});

test('claim without benefitCategory is skipped', () => {
  const rows = [{ claimId: 'c1', benefitCategory: null }];
  const result = aggregateBenefitCategories(rows);
  assertEqual(result.length, 0);
});

test('counts accumulate per category', () => {
  const rows = [
    { claimId: 'c1', benefitCategory: EYE_HEALTH },
    { claimId: 'c2', benefitCategory: EYE_HEALTH },
    { claimId: 'c3', benefitCategory: BONE_HEALTH },
  ];
  const result = aggregateBenefitCategories(rows);
  assertEqual(result.length, 2);
  assertEqual(result[0].id, 'bc1');
  assertEqual(result[0].claimCount, 2);
  assertEqual(result[1].id, 'bc2');
  assertEqual(result[1].claimCount, 1);
});

test('categories sorted by claimCount descending', () => {
  const rows = [
    { claimId: 'c1', benefitCategory: BONE_HEALTH },
    { claimId: 'c2', benefitCategory: EYE_HEALTH },
    { claimId: 'c3', benefitCategory: EYE_HEALTH },
  ];
  const result = aggregateBenefitCategories(rows);
  assertEqual(result[0].id, 'bc1', 'Eye Health (2) before Bone Health (1)');
});

// ─── 3. Region-aware filtering in CAIPB context ───────────────────────────────
console.log('\nRegion-aware filtering (CAIPB):');

test('no region → all rows returned', () => {
  const rows = [
    { authorityRegions: ['FDA'] },
    { authorityRegions: ['EFSA'] },
    { authorityRegions: [] },
  ];
  assertEqual(filterByRegion(rows, '').length, 3);
  assertEqual(filterByRegion(rows, null).length, 3);
});

test('FDA filter returns only FDA rows', () => {
  const rows = [
    { authorityRegions: ['FDA'] },
    { authorityRegions: ['EFSA'] },
    { authorityRegions: ['FDA', 'EFSA'] },
  ];
  const result = filterByRegion(rows, 'FDA');
  assertEqual(result.length, 2);
});

test('unknown region returns empty', () => {
  const rows = [{ authorityRegions: ['FDA'] }];
  assertEqual(filterByRegion(rows, 'ANVISA').length, 0);
});

test('row with empty authorityRegions hidden when filter active', () => {
  const rows = [{ authorityRegions: [] }, { authorityRegions: ['FDA'] }];
  assertEqual(filterByRegion(rows, 'FDA').length, 1);
});

// ─── 4. authorityRegions patch validation ────────────────────────────────────
console.log('\nAuthorityRegions patch validation:');

test('valid subset passes', () => {
  const result = validateAuthorityRegions(['FDA', 'EFSA']);
  assertEqual(result.valid, true);
});

test('empty array passes', () => {
  const result = validateAuthorityRegions([]);
  assertEqual(result.valid, true);
});

test('unknown region fails', () => {
  const result = validateAuthorityRegions(['FDA', 'ANVISA']);
  assertEqual(result.valid, false);
  assertTrue(result.error.includes('ANVISA'), 'error names the invalid region');
});

test('non-array fails', () => {
  const result = validateAuthorityRegions('FDA');
  assertEqual(result.valid, false);
});

test('all CLAIM_AUTHORITY_REGIONS individually validate', () => {
  for (const r of CLAIM_AUTHORITY_REGIONS) {
    const result = validateAuthorityRegions([r]);
    assertTrue(result.valid, `${r} must be valid`);
  }
});

// ─── 5. Cross-link integrity ─────────────────────────────────────────────────
console.log('\nCAIPB cross-link integrity:');

test('ingredient → benefit link: benefitCategory.id used as navigation key', () => {
  const rows = [
    { claimId: 'c1', benefitCategory: { id: 'bc-123', name: 'Eye Health' } },
  ];
  const categories = aggregateBenefitCategories(rows);
  assertEqual(categories[0].id, 'bc-123', 'id preserved for href construction');
});

test('form usage rollup does not mutate input products array', () => {
  const original = [{ aiForm: 'A' }, { aiForm: 'B' }];
  const before = original.length;
  computeFormUsage(original);
  assertEqual(original.length, before, 'input must not be mutated');
});

test('benefit aggregation does not mutate input rows', () => {
  const rows = [{ claimId: 'c1', benefitCategory: EYE_HEALTH }];
  const before = rows.length;
  aggregateBenefitCategories(rows);
  assertEqual(rows.length, before, 'input must not be mutated');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

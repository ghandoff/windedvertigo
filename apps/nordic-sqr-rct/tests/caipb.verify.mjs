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
import { can } from '../src/lib/auth/capabilities.js';
import { ROLE_SETS } from '../src/lib/auth/has-any-role.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (rel) => readFileSync(resolve(__appRoot, rel), 'utf8');

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

// ─── 6. Benefit-dashboard product aggregation (version → document join) ───────
console.log('\nBenefit product aggregation:');

/** Mirror of the product join in /api/pcs/caipb/benefit/[id]/route.js */
function aggregateBenefitProducts(claimRows, versionById, documentById) {
  const map = new Map();
  for (const row of claimRows) {
    if (!row.pcsVersionId) continue;
    const version = versionById[row.pcsVersionId];
    const doc = version?.pcsDocumentId ? documentById[version.pcsDocumentId] : null;
    const key = doc?.id || `version:${row.pcsVersionId}`;
    if (!map.has(key)) {
      map.set(key, {
        id: doc?.id || null,
        name: doc?.finishedGoodName || doc?.pcsId || null,
        pcsId: doc?.pcsId || null,
        claimCount: 0,
      });
    }
    map.get(key).claimCount++;
  }
  return [...map.values()].sort((a, b) => b.claimCount - a.claimCount);
}

const VERSIONS = { v1: { id: 'v1', pcsDocumentId: 'd1' }, v2: { id: 'v2', pcsDocumentId: 'd1' }, v3: { id: 'v3', pcsDocumentId: 'd2' } };
const DOCS = { d1: { id: 'd1', finishedGoodName: 'Sleep Plus', pcsId: 'PCS-001' }, d2: { id: 'd2', finishedGoodName: 'Calm Caps', pcsId: 'PCS-002' } };

test('resolves product name + id from version → document', () => {
  const result = aggregateBenefitProducts([{ pcsVersionId: 'v1' }], VERSIONS, DOCS);
  assertEqual(result.length, 1);
  assertEqual(result[0].id, 'd1');
  assertEqual(result[0].name, 'Sleep Plus');
  assertEqual(result[0].pcsId, 'PCS-001');
});

test('two versions of the same document collapse into one product', () => {
  const rows = [{ pcsVersionId: 'v1' }, { pcsVersionId: 'v2' }];
  const result = aggregateBenefitProducts(rows, VERSIONS, DOCS);
  assertEqual(result.length, 1, 'v1+v2 share document d1');
  assertEqual(result[0].claimCount, 2);
});

test('unresolved version is not dropped (fallback key, null id)', () => {
  const result = aggregateBenefitProducts([{ pcsVersionId: 'ghost' }], VERSIONS, DOCS);
  assertEqual(result.length, 1);
  assertEqual(result[0].id, null);
  assertEqual(result[0].claimCount, 1);
});

test('products sorted by claimCount descending', () => {
  const rows = [{ pcsVersionId: 'v3' }, { pcsVersionId: 'v1' }, { pcsVersionId: 'v1' }];
  const result = aggregateBenefitProducts(rows, VERSIONS, DOCS);
  assertEqual(result[0].id, 'd1', 'd1 (2) before d2 (1)');
});

// ─── 7. Backfill editor gate (role enforcement) ──────────────────────────────
console.log('\nBackfill editor gate:');

for (const role of ['researcher', 'ra', 'admin', 'super-user']) {
  test(`${role} holds pcs.claims:edit (can backfill authority regions)`, () => {
    assertTrue(can({ roles: [role] }, 'pcs.claims:edit'), `${role} must hold pcs.claims:edit`);
  });
}

for (const role of ['reviewer', 'pcs-readonly']) {
  test(`${role} is denied pcs.claims:edit`, () => {
    assertTrue(!can({ roles: [role] }, 'pcs.claims:edit'), `${role} must NOT hold pcs.claims:edit`);
  });
}

test('PCS_WRITERS includes super-user (editor visible to the god role)', () => {
  assertTrue(ROLE_SETS.PCS_WRITERS.includes('super-user'), 'super-user must see write controls');
});

// ─── 8. Audited authority-regions write path (source guard) ──────────────────
console.log('\nAudited authority-regions write path:');

const claimRouteSrc = readSrc('src/app/api/pcs/claims/[id]/route.js');
const claimsLibSrc = readSrc('src/lib/pcs-claims.js');

test('claim PATCH routes authorityRegions through audited updateClaimField', () => {
  assertTrue(claimRouteSrc.includes('updateClaimField'), 'route must use updateClaimField');
  assertTrue(/fieldPath:\s*['"]authorityRegions['"]/.test(claimRouteSrc), 'authorityRegions routed via updateClaimField');
});

test('authorityRegions is excluded from the non-audited bulk updateClaim', () => {
  assertTrue(/const\s*\{\s*authorityRegions\s*,\s*\.\.\.rest\s*\}/.test(claimRouteSrc), 'authorityRegions split out of bulk write');
});

test('updateClaimField allowlist + coercion include authorityRegions', () => {
  assertTrue(claimsLibSrc.includes("'authorityRegions',"), 'present in ALLOWED set');
  assertTrue(claimsLibSrc.includes("case 'authorityRegions':"), 'coercion + payload case present');
});

// ─── 9. Dashboard enrichment (source guard) ──────────────────────────────────
console.log('\nDashboard enrichment:');

test('ingredient product table surfaces PCS doc version', () => {
  const src = readSrc('src/app/api/pcs/caipb/ingredient/[id]/route.js');
  assertTrue(/pcsVersion:\s*version\?\.version/.test(src), 'pcsVersion surfaced from version record');
});

test('benefit route joins versions + documents to label products', () => {
  const src = readSrc('src/app/api/pcs/caipb/benefit/[id]/route.js');
  assertTrue(src.includes('getAllVersions') && src.includes('getAllDocuments'), 'version/document join imported');
  assertTrue(src.includes('finishedGoodName'), 'product name surfaced on benefit products');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

#!/usr/bin/env node
/**
 * Verification harness for pure logic in pcs-explorer.js and pcs-config.js.
 *
 * Why we define filterByRegion inline rather than importing it:
 *   pcs-explorer.js has top-level ESM imports of getAllClaims, getAllEvidence,
 *   etc. — those transitively require Notion/Supabase credentials. Importing
 *   the module in a bare Node.js test would throw. We inline the pure function
 *   verbatim so the test stays zero-dependency while verifying the contract.
 *
 * Tests:
 *   1. filterByRegion — no filter → all rows returned
 *   2. filterByRegion — matching region → only matching rows
 *   3. filterByRegion — no matches → empty array
 *   4. filterByRegion — rows with empty authorityRegions are hidden when filter active
 *   5. filterByRegion — multiple regions per row (row appears for any matching region)
 *   6. filterByRegion — falsy region values ('', null, undefined) all mean "no filter"
 *   7. CLAIM_AUTHORITY_REGIONS — expected authorities are present
 *   8. CLAIM_AUTHORITY_REGIONS — no duplicates
 *   9. CLAIM_AUTHORITY_REGIONS — each entry is a non-empty string
 *
 * Usage:
 *   node tests/pcs-explorer.verify.mjs
 */

// ─── Import only the pure-constant export ─────────────────────────────────────
// pcs-config.js has no I/O side effects — safe to import directly.
import { CLAIM_AUTHORITY_REGIONS } from '../src/lib/pcs-config.js';

// ─── filterByRegion — inline copy from pcs-explorer.js ───────────────────────
// Keep this in sync with the implementation in src/lib/pcs-explorer.js.
function filterByRegion(rows, region) {
  if (!region) return rows;
  return rows.filter(row =>
    Array.isArray(row.authorityRegions) && row.authorityRegions.includes(region)
  );
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

function assertFalse(v, msg) {
  if (v) throw new Error(msg ?? 'Expected false, got true');
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ROW_FDA = { claimId: 'c1', claimText: 'Supports eye health', authorityRegions: ['FDA'] };
const ROW_EFSA = { claimId: 'c2', claimText: 'Supports vision', authorityRegions: ['EFSA'] };
const ROW_MULTI = { claimId: 'c3', claimText: 'Bone health', authorityRegions: ['FDA', 'Health Canada', 'TGA'] };
const ROW_EMPTY = { claimId: 'c4', claimText: 'Unassessed claim', authorityRegions: [] };
const ROW_NULL_REGIONS = { claimId: 'c5', claimText: 'Old record', authorityRegions: null };
const ALL_ROWS = [ROW_FDA, ROW_EFSA, ROW_MULTI, ROW_EMPTY, ROW_NULL_REGIONS];

// ─── 1–6. filterByRegion ──────────────────────────────────────────────────────
console.log('\nfilterByRegion:');

test('no filter (empty string) → returns all rows', () => {
  const result = filterByRegion(ALL_ROWS, '');
  assertEqual(result.length, ALL_ROWS.length);
});

test('no filter (null) → returns all rows', () => {
  const result = filterByRegion(ALL_ROWS, null);
  assertEqual(result.length, ALL_ROWS.length);
});

test('no filter (undefined) → returns all rows', () => {
  const result = filterByRegion(ALL_ROWS, undefined);
  assertEqual(result.length, ALL_ROWS.length);
});

test('FDA filter → only FDA rows', () => {
  const result = filterByRegion(ALL_ROWS, 'FDA');
  // ROW_FDA + ROW_MULTI both have FDA
  assertEqual(result.length, 2);
  assertTrue(result.some(r => r.claimId === 'c1'), 'ROW_FDA must be included');
  assertTrue(result.some(r => r.claimId === 'c3'), 'ROW_MULTI must be included (has FDA)');
});

test('EFSA filter → only EFSA rows', () => {
  const result = filterByRegion(ALL_ROWS, 'EFSA');
  assertEqual(result.length, 1);
  assertEqual(result[0].claimId, 'c2');
});

test('Health Canada filter → only ROW_MULTI', () => {
  const result = filterByRegion(ALL_ROWS, 'Health Canada');
  assertEqual(result.length, 1);
  assertEqual(result[0].claimId, 'c3');
});

test('TGA filter → only ROW_MULTI', () => {
  const result = filterByRegion(ALL_ROWS, 'TGA');
  assertEqual(result.length, 1);
  assertEqual(result[0].claimId, 'c3');
});

test('Unknown region → empty array', () => {
  const result = filterByRegion(ALL_ROWS, 'ANVISA');
  assertEqual(result.length, 0);
});

test('Row with empty authorityRegions is excluded when filter is active', () => {
  const result = filterByRegion(ALL_ROWS, 'FDA');
  assertFalse(result.some(r => r.claimId === 'c4'), 'Empty authorityRegions row must be excluded');
});

test('Row with null authorityRegions is excluded when filter is active', () => {
  const result = filterByRegion(ALL_ROWS, 'FDA');
  assertFalse(result.some(r => r.claimId === 'c5'), 'null authorityRegions row must be excluded');
});

test('filterByRegion does not mutate the input array', () => {
  const original = [...ALL_ROWS];
  filterByRegion(ALL_ROWS, 'FDA');
  assertEqual(ALL_ROWS.length, original.length, 'input array must not be mutated');
});

test('filterByRegion on empty rows array → empty array', () => {
  const result = filterByRegion([], 'FDA');
  assertEqual(result.length, 0);
});

test('multi-region row appears once per filter match (not duplicated)', () => {
  const result = filterByRegion([ROW_MULTI], 'FDA');
  assertEqual(result.length, 1, 'multi-region row must appear exactly once');
});

// ─── 7–9. CLAIM_AUTHORITY_REGIONS ────────────────────────────────────────────
console.log('\nCLAIM_AUTHORITY_REGIONS:');

test('CLAIM_AUTHORITY_REGIONS is an array', () => {
  assertTrue(Array.isArray(CLAIM_AUTHORITY_REGIONS));
});

test('FDA is in CLAIM_AUTHORITY_REGIONS', () => {
  assertTrue(CLAIM_AUTHORITY_REGIONS.includes('FDA'));
});

test('EFSA is in CLAIM_AUTHORITY_REGIONS', () => {
  assertTrue(CLAIM_AUTHORITY_REGIONS.includes('EFSA'));
});

test('Health Canada is in CLAIM_AUTHORITY_REGIONS', () => {
  assertTrue(CLAIM_AUTHORITY_REGIONS.includes('Health Canada'));
});

test('TGA is in CLAIM_AUTHORITY_REGIONS', () => {
  assertTrue(CLAIM_AUTHORITY_REGIONS.includes('TGA'));
});

test('FSANZ is in CLAIM_AUTHORITY_REGIONS', () => {
  assertTrue(CLAIM_AUTHORITY_REGIONS.includes('FSANZ'));
});

test('Japan MHLW is in CLAIM_AUTHORITY_REGIONS', () => {
  assertTrue(CLAIM_AUTHORITY_REGIONS.includes('Japan MHLW'));
});

test('CLAIM_AUTHORITY_REGIONS has no duplicates', () => {
  const unique = new Set(CLAIM_AUTHORITY_REGIONS);
  assertEqual(unique.size, CLAIM_AUTHORITY_REGIONS.length, 'all authority entries must be unique');
});

test('each CLAIM_AUTHORITY_REGIONS entry is a non-empty string', () => {
  for (const r of CLAIM_AUTHORITY_REGIONS) {
    assertTrue(typeof r === 'string' && r.trim().length > 0, `entry "${r}" must be a non-empty string`);
  }
});

test('filterByRegion matches all CLAIM_AUTHORITY_REGIONS entries against test data', () => {
  const testRows = CLAIM_AUTHORITY_REGIONS.map((r, i) => ({
    claimId: `auto-${i}`,
    claimText: `Claim for ${r}`,
    authorityRegions: [r],
  }));
  for (const r of CLAIM_AUTHORITY_REGIONS) {
    const result = filterByRegion(testRows, r);
    assertEqual(result.length, 1, `filterByRegion with "${r}" must return exactly 1 row`);
    assertEqual(result[0].authorityRegions[0], r);
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

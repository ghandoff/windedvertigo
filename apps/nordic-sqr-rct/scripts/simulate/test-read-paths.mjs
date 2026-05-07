#!/usr/bin/env node
/**
 * Smoke test for the Path-2 Phase A read paths.
 *
 * Hits every Postgres-backed /api/pcs/* endpoint, asserts:
 *   - 200 status (or 401 if auth-gated and no COOKIE provided)
 *   - non-zero row count where data is expected
 *   - latency under target (cold MISS < 500ms is the soft target)
 *
 * Usage:
 *   COOKIE='<session-cookie>' node scripts/simulate/test-read-paths.mjs
 *   BASE_URL=http://localhost:3000 node scripts/simulate/test-read-paths.mjs
 *
 * Without COOKIE: every auth-gated route returns 401, which the test
 * treats as a SUCCESS signal (proves the route loaded + auth ran). With
 * COOKIE: also asserts row counts match expected baseline.
 */

import { suite, test, run, assert, timed, authedFetch, BASE_URL, fmt } from './_lib.mjs';

const ROUTES = [
  // [path, expected min rows when authed, latency target ms]
  ['/api/pcs/evidence',          80,    500],
  ['/api/pcs/claims',            450,   500],
  ['/api/pcs/documents',         30,    500],
  ['/api/pcs/ingredients',       1,     500],
  ['/api/pcs/canonical-claims',  90,    500],
];

suite('read paths — auth-gated GETs');

const hasCookie = !!process.env.COOKIE;
console.log(`Using ${hasCookie ? 'authed (COOKIE present)' : 'anonymous (no COOKIE)'} mode against ${BASE_URL}`);

for (const [path, minRows, targetMs] of ROUTES) {
  test(`GET ${path}${hasCookie ? ' returns ≥ ' + minRows + ' rows' : ' returns 401 (no auth)'}`, async () => {
    const cb = `?cb=${Date.now()}-${Math.random()}`;
    const { result: r, ms } = await timed(() => authedFetch(`${BASE_URL}${path}${cb}`));
    if (!hasCookie) {
      assert(r.status === 401, `expected 401 (no cookie), got ${r.status}`);
      return;
    }
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const body = await r.json();
    const rows = Array.isArray(body) ? body.length : (body.items?.length ?? 0);
    assert(rows >= minRows, `expected ≥ ${minRows} rows, got ${rows}`);
    const cache = r.headers.get('x-vercel-cache') || 'unknown';
    if (ms > targetMs && cache === 'MISS') {
      console.log(`      ⚠ slow MISS: ${ms}ms (target ${targetMs}ms)`);
    }
    console.log(`      ${fmt.count(rows)} rows · ${cache} · ${fmt.bytes((await r.clone().text()).length)}`);
  });
}

suite('read paths — by-filter helpers');

if (hasCookie) {
  test('GET /api/pcs/evidence?ingredient=Magnesium returns Magnesium rows', async () => {
    const { result: r } = await timed(() =>
      authedFetch(`${BASE_URL}/api/pcs/evidence?ingredient=Magnesium`),
    );
    assert(r.status === 200, `got ${r.status}`);
    const body = await r.json();
    const rows = Array.isArray(body) ? body : body.items || [];
    assert(rows.length > 0, 'expected at least one Magnesium row');
    const allMagnesium = rows.every((row) => (row.ingredient || []).includes('Magnesium'));
    assert(allMagnesium, 'every returned row should include Magnesium in its ingredient list');
    console.log(`      ${rows.length} Magnesium rows verified`);
  });

  test('GET /api/pcs/evidence?type=RCT returns RCT rows', async () => {
    const { result: r } = await timed(() =>
      authedFetch(`${BASE_URL}/api/pcs/evidence?type=RCT`),
    );
    assert(r.status === 200, `got ${r.status}`);
    const body = await r.json();
    const rows = Array.isArray(body) ? body : body.items || [];
    const allRct = rows.every((row) => row.evidenceType === 'RCT');
    assert(allRct, 'every returned row should have evidenceType=RCT');
    console.log(`      ${rows.length} RCT rows verified`);
  });
} else {
  test('skipping by-filter assertions (no COOKIE)', () => {
    console.log('      skip — set COOKIE env to enable authed assertions');
  });
}

suite('admin observability');

test(`GET /api/admin/postgres-mirror-status${hasCookie ? ' returns ok=true' : ' returns 401 (no auth)'}`, async () => {
  const { result: r, ms } = await timed(() =>
    authedFetch(`${BASE_URL}/api/admin/postgres-mirror-status`),
  );
  if (!hasCookie) {
    assert(r.status === 401 || r.status === 403, `expected 401/403 (no cookie), got ${r.status}`);
    return;
  }
  assert(r.status === 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert(body.ok === true, 'expected ok=true');
  assert(Array.isArray(body.results), 'expected results array');
  const tables = body.results.length;
  const ok = body.summary?.ok ?? 0;
  const drifted = body.summary?.drifted ?? 0;
  console.log(`      ${tables} tables · ${ok} ok · ${drifted} drifted · sweep took ${ms}ms`);
  if (drifted > 0) {
    console.log(`      ⚠ ${drifted} tables drifted — investigate at /admin/postgres-mirror`);
  }
});

await run();

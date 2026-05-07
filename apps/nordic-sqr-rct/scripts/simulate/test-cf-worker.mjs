#!/usr/bin/env node
/**
 * Compare CF Worker (Phase C) responses + timings against Vercel.
 *
 * The Phase C worker at https://wv-nordic-pcs.windedvertigo.workers.dev
 * exposes a tiny read-only PoC with /health, /health/db, /api/pcs/evidence,
 * /api/pcs/claims. This test:
 *   1. Hits each endpoint and asserts shape correctness
 *   2. Measures latency 5x and reports min/p50/max
 *   3. Cross-references Postgres row counts against the Vercel deploy
 *      (which serves from the same Postgres) to confirm both stacks
 *      see the same data
 *
 * Phase C is unauthenticated by design (read-only PoC). The Vercel
 * comparison routes are auth-gated, so we only compare row counts via
 * the mirror-status endpoint (also auth-gated, but skipped if no COOKIE).
 *
 * Usage:
 *   node scripts/simulate/test-cf-worker.mjs
 *   COOKIE='...' node scripts/simulate/test-cf-worker.mjs   # cross-check row counts
 */

import { suite, test, run, assert, timed, authedFetch, BASE_URL, fmt } from './_lib.mjs';

const CF_BASE = process.env.CF_BASE || 'https://wv-nordic-pcs.windedvertigo.workers.dev';
const hasCookie = !!process.env.COOKIE;

console.log(`CF Worker: ${CF_BASE}`);
console.log(`Vercel:    ${BASE_URL}\n`);

suite('CF Worker — health + read endpoints');

test('GET /health returns ok=true', async () => {
  const { result: r, ms } = await timed(() => fetch(`${CF_BASE}/health`));
  assert(r.status === 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert(body.ok === true, `expected ok=true`);
  assert(body.env?.supabase === true, `expected env.supabase=true (secret was set?)`);
  console.log(`      ${fmt.ms(ms)} · supabase env wired: ${body.env.supabase}`);
});

test('GET /health/db returns count + ms', async () => {
  const { result: r, ms } = await timed(() => fetch(`${CF_BASE}/health/db`));
  assert(r.status === 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert(body.ok === true, `expected ok=true (Supabase reachable)`);
  assert(body.count >= 80, `expected count ≥ 80, got ${body.count}`);
  console.log(`      ${fmt.ms(ms)} · Postgres returned ${body.count} evidence rows in ${body.ms}ms`);
});

test('GET /api/pcs/evidence returns count + array', async () => {
  const { result: r } = await timed(() => fetch(`${CF_BASE}/api/pcs/evidence`));
  assert(r.status === 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert(body.ok === true, `expected ok=true`);
  assert(typeof body.count === 'number', `expected numeric count`);
  assert(Array.isArray(body.evidence), `expected evidence array`);
  assert(body.count === body.evidence.length, `count should match array length`);
  console.log(`      ${body.count} rows`);
});

test('GET /api/pcs/claims returns count + array', async () => {
  const { result: r } = await timed(() => fetch(`${CF_BASE}/api/pcs/claims`));
  assert(r.status === 200, `expected 200, got ${r.status}`);
  const body = await r.json();
  assert(body.ok === true, `expected ok=true`);
  assert(typeof body.count === 'number', `expected numeric count`);
  assert(Array.isArray(body.claims), `expected claims array`);
  console.log(`      ${body.count} rows`);
});

suite('CF Worker — latency profile (5x cold)');

test('/health/db cold-burst latency', async () => {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const t = Date.now();
    const r = await fetch(`${CF_BASE}/health/db?cb=${Date.now()}-${i}`);
    samples.push(Date.now() - t);
    assert(r.status === 200, `request ${i} got ${r.status}`);
    await new Promise((res) => setTimeout(res, 100));
  }
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(samples.length / 2)];
  console.log(`      min ${fmt.ms(min)} · p50 ${fmt.ms(p50)} · max ${fmt.ms(max)} · samples ${samples.map((s) => `${s}ms`).join(', ')}`);
  // Loose target: p50 < 500ms. CF should comfortably beat this; warn if not.
  if (p50 > 500) console.log(`      ⚠ p50 above 500ms target — investigate`);
});

suite('CF vs Vercel row-count parity');

test('CF and Vercel both see the same evidence count', async () => {
  const cf = await fetch(`${CF_BASE}/api/pcs/evidence`).then((r) => r.json());
  if (!hasCookie) {
    console.log(`      CF: ${cf.count} rows · Vercel: skip (no COOKIE)`);
    return;
  }
  const v = await authedFetch(`${BASE_URL}/api/pcs/evidence?cb=${Date.now()}`).then((r) => r.json());
  const vCount = Array.isArray(v) ? v.length : v.items?.length;
  assert(cf.count === vCount, `CF=${cf.count} vs Vercel=${vCount}`);
  console.log(`      both see ${cf.count} rows ✓`);
});

test('CF and Vercel both see the same claims count', async () => {
  const cf = await fetch(`${CF_BASE}/api/pcs/claims`).then((r) => r.json());
  if (!hasCookie) {
    console.log(`      CF: ${cf.count} rows · Vercel: skip (no COOKIE)`);
    return;
  }
  const v = await authedFetch(`${BASE_URL}/api/pcs/claims?cb=${Date.now()}`).then((r) => r.json());
  const vCount = Array.isArray(v) ? v.length : v.items?.length;
  assert(cf.count === vCount, `CF=${cf.count} vs Vercel=${vCount}`);
  console.log(`      both see ${cf.count} rows ✓`);
});

await run();

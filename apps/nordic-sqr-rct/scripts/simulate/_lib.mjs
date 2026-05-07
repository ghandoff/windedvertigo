/**
 * Shared test framework for the simulate/* scripts.
 *
 * Path-2 production smoke testing. Each script exercises a slice of
 * the platform; this module provides a tiny test runner so output is
 * consistent and aggregated pass/fail counts surface clearly.
 *
 * Usage:
 *   import { test, suite, run, fmt } from './_lib.mjs';
 *
 *   suite('read paths');
 *   test('GET /api/pcs/evidence returns 200', async () => {
 *     const r = await fetch(...);
 *     if (r.status !== 200) throw new Error(`got ${r.status}`);
 *   });
 *
 *   await run();
 */

const tests = [];
let currentSuite = '';

export function suite(name) {
  currentSuite = name;
}

export function test(name, fn) {
  tests.push({ suite: currentSuite, name, fn });
}

export async function run() {
  const start = Date.now();
  const results = { pass: 0, fail: 0, total: 0, failures: [] };
  let lastSuite = null;
  for (const t of tests) {
    if (t.suite !== lastSuite) {
      console.log(`\n— ${t.suite}`);
      lastSuite = t.suite;
    }
    results.total++;
    const tStart = Date.now();
    try {
      await t.fn();
      results.pass++;
      console.log(`  ✓ ${t.name}  ${fmt.ms(Date.now() - tStart)}`);
    } catch (err) {
      results.fail++;
      results.failures.push({ test: t.name, suite: t.suite, error: err.message });
      console.log(`  ✗ ${t.name}  ${fmt.ms(Date.now() - tStart)}`);
      console.log(`      ${err.message}`);
    }
  }
  const totalMs = Date.now() - start;
  console.log(
    `\n${'─'.repeat(60)}\n${results.pass}/${results.total} passed  (${fmt.ms(totalMs)})`,
  );
  if (results.fail > 0) {
    console.log(`\n${results.fail} failures:`);
    for (const f of results.failures) {
      console.log(`  • [${f.suite}] ${f.test} — ${f.error}`);
    }
    process.exit(1);
  }
}

export const fmt = {
  ms(n) {
    if (n < 1000) return `${n}ms`;
    return `${(n / 1000).toFixed(1)}s`;
  },
  bytes(n) {
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
  },
  count(n) {
    return n.toLocaleString();
  },
};

/**
 * Helper to assert a condition with a descriptive error.
 */
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Time a function call. Returns { result, ms }.
 */
export async function timed(fn) {
  const t = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t };
}

/**
 * Authenticated fetch — pulls a session cookie from $COOKIE env var
 * if set, else falls back to anonymous. Anonymous requests will 401
 * on auth-gated routes; tests that need data should set $COOKIE.
 *
 * To get a cookie value: log in via the browser, open devtools →
 * Application → Cookies → copy the session cookie value, then run
 * `COOKIE='<value>' node scripts/simulate/...`.
 */
export function authedFetch(url, init = {}) {
  const cookie = process.env.COOKIE;
  const headers = { ...(init.headers || {}) };
  if (cookie) headers.cookie = cookie;
  return fetch(url, { ...init, headers });
}

export const BASE_URL = process.env.BASE_URL || 'https://nordic.windedvertigo.com';

#!/usr/bin/env node
/**
 * port smoke test — 26 routes (corrected expectations)
 *
 * Verifies the auth middleware, canonical redirects, and protected APIs
 * all return the right HTTP status codes, without needing credentials.
 *
 * Usage:  node port/scripts/smoke-test.mjs
 *         BASE=https://port.windedvertigo.com node port/scripts/smoke-test.mjs
 */

const BASE = process.env.BASE ?? "https://port.windedvertigo.com";

const ROUTES = [
  // public / infrastructure
  { path: "/api/version",   expect: 200, note: "public" },
  { path: "/login",         expect: 200, note: "public" },
  // /api/members is auth-protected (not in public allowlist) → 401
  { path: "/api/members",   expect: 401, note: "auth-protected static route" },
  // protected pages → 307 redirect to /login
  { path: "/",              expect: 307 },
  { path: "/projects",      expect: 307 },
  { path: "/contacts",      expect: 307 },
  { path: "/opportunities", expect: 307 },
  { path: "/strategy",      expect: 307 },
  { path: "/campaigns",     expect: 307 },
  { path: "/events",        expect: 307 },
  { path: "/organizations", expect: 307 },
  { path: "/ai-hub",        expect: 307 },
  { path: "/docent",        expect: 307 },
  { path: "/work/time",     expect: 307 },
  // permanent canonical redirects (308 = cache the redirect)
  { path: "/deals",         expect: 308, note: "→ /opportunities?tab=deals" },
  { path: "/work/studios",  expect: 308, note: "→ /projects?type=studios" },
  // unknown route → auth middleware intercepts before 404 (correct for private app)
  { path: "/this-does-not-exist", expect: 307, note: "auth before 404" },
  // protected APIs → 401
  { path: "/api/contacts",    expect: 401 },
  { path: "/api/projects",    expect: 401 },
  { path: "/api/deals",       expect: 401 },
  { path: "/api/rfp-radar",   expect: 401 },
  { path: "/api/campaigns",   expect: 401 },
  { path: "/api/competitors", expect: 401 },
  { path: "/api/events",      expect: 401 },
  { path: "/api/me",          expect: 401 },
  // revenue PATCH route (unauthenticated) → 401
  { path: "/api/deals/test-id/revenue", method: "PATCH", body: "{}", expect: 401 },
];

console.log(`\n▶  smoke test — ${BASE}\n`);

let pass = 0, fail = 0;
const timings = [];

await Promise.all(ROUTES.map(async ({ path, method = "GET", body, expect: expected, note }) => {
  const opts = { method, redirect: "manual" };
  if (body) { opts.body = body; opts.headers = { "Content-Type": "application/json" }; }
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, opts);
  const ms = Date.now() - t0;
  timings.push(ms);
  const ok = res.status === expected;
  const icon = ok ? "✅" : "❌";
  const tag = note ? `  (${note})` : "";
  const line = `${icon}  ${res.status}  [${ms}ms]  ${method.padEnd(5)}  ${path}${tag}`;
  if (ok) pass++; else fail++;
  if (!ok) console.log(`${line}  ← expected ${expected}`);
  else console.log(line);
}));

const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
const max = Math.max(...timings);
const min = Math.min(...timings);

console.log("");
console.log("─".repeat(60));
console.log(`Smoke: ${pass}/${ROUTES.length} passed · ${fail} failed`);
console.log(`Latency: min ${min}ms · avg ${avg}ms · max ${max}ms`);
process.exit(fail > 0 ? 1 : 0);

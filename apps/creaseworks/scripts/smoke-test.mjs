#!/usr/bin/env node
/**
 * End-to-end smoke test — hits every public and protected route
 * and reports HTTP status, response time, and title/meta presence.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                     # defaults to localhost:3000
 *   node scripts/smoke-test.mjs https://windedvertigo.com/reservoir/creaseworks
 *
 * Requires: Node 18+ (uses native fetch).
 * No extra dependencies.
 */

const BASE = process.argv[2] || "http://localhost:3000/reservoir/creaseworks";

/* ── Route definitions ────────────────────────────────────── */

/** Public routes — should return 200 for any visitor. */
const publicRoutes = [
  "/",
  "/login",
  "/packs",
  "/sampler",
  "/matcher",
  "/vault",
];

/**
 * Auth-protected routes — typically redirect to /login (302/303)
 * for unauthenticated users, or return 200 if session cookie present.
 */
const protectedRoutes = [
  "/playbook",
  "/playbook/portfolio",
  "/playbook/reflections",
  "/playbook/runs",
  "/profile",
  "/team",
  "/runs",
  "/runs/new",
  "/reflections/new",
  "/onboarding",
  "/checkout/success",
  "/gallery",
  "/community",
  "/scavenger",
];

/** Admin routes — redirect or 403 for non-admin users. */
const adminRoutes = [
  "/admin",
  "/admin/playdates",
  "/admin/entitlements",
  "/admin/admins",
  "/admin/domains",
  "/admin/invites",
  "/admin/campaigns",
  "/admin/gallery",
  "/admin/sync",
];

/** API routes — should return JSON. */
const apiRoutes = [
  { path: "/api/health", method: "GET", expectStatus: [200, 302, 303, 307] },
  { path: "/api/vault", method: "GET", expectStatus: [200] },
];

/* ── Test runner ──────────────────────────────────────────── */

const results = [];
let passed = 0;
let warned = 0;
let failed = 0;

async function testRoute(path, expectedStatuses, label = "") {
  const url = `${BASE}${path}`;
  const tag = label || path;
  const start = Date.now();

  try {
    const res = await fetch(url, {
      redirect: "manual",             // don't follow redirects
      headers: { "User-Agent": "creaseworks-smoke-test/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - start;
    const status = res.status;
    const ok = expectedStatuses.includes(status);

    // Check for HTML title in 200 responses
    let hasTitle = "—";
    let hasOgTitle = "—";
    if (status === 200 && res.headers.get("content-type")?.includes("text/html")) {
      const body = await res.text();
      hasTitle = /<title[^>]*>.+<\/title>/i.test(body) ? "✓" : "✗";
      hasOgTitle = /property="og:title"/i.test(body) ? "✓" : "✗";
    }

    const icon = ok ? "✅" : "⚠️";
    if (ok) passed++;
    else warned++;

    results.push({ tag, status, ms, hasTitle, hasOgTitle, ok, icon });
  } catch (err) {
    const ms = Date.now() - start;
    failed++;
    results.push({
      tag,
      status: `ERR`,
      ms,
      hasTitle: "—",
      hasOgTitle: "—",
      ok: false,
      icon: "❌",
      error: err.message?.slice(0, 60),
    });
  }
}

console.log(`\n🔍  Smoke testing ${BASE}\n`);

/* ── Run all tests ───────────────────────────────────────── */

// Public routes — expect 200
for (const path of publicRoutes) {
  await testRoute(path, [200], `[pub] ${path}`);
}

// Protected routes — expect 302/303/307 (redirect to login) when unauthenticated.
// Some routes (e.g. /checkout/success) may return 200 with a generic message.
for (const path of protectedRoutes) {
  await testRoute(path, [200, 302, 303, 307, 308], `[auth] ${path}`);
}

// Admin routes — expect 302/303/403
for (const path of adminRoutes) {
  await testRoute(path, [302, 303, 307, 308, 403], `[admin] ${path}`);
}

// API routes
for (const { path, expectStatus } of apiRoutes) {
  await testRoute(path, expectStatus, `[api] ${path}`);
}

/* ── Report ──────────────────────────────────────────────── */

console.log("─".repeat(80));
console.log(
  `${"Route".padEnd(40)} ${"Status".padEnd(8)} ${"Time".padEnd(8)} ${"Title".padEnd(6)} ${"OG".padEnd(4)}`
);
console.log("─".repeat(80));

for (const r of results) {
  const statusStr = String(r.status).padEnd(8);
  const msStr = `${r.ms}ms`.padEnd(8);
  const line = `${r.icon} ${r.tag.padEnd(38)} ${statusStr} ${msStr} ${r.hasTitle.padEnd(6)} ${r.hasOgTitle}`;
  console.log(line);
  if (r.error) console.log(`   └─ ${r.error}`);
}

console.log("─".repeat(80));
console.log(`\n✅ ${passed} passed   ⚠️ ${warned} warnings   ❌ ${failed} errors\n`);

if (failed > 0) process.exit(1);

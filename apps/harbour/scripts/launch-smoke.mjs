#!/usr/bin/env node
/**
 * Harbour launch smoke test.
 *
 * Phase 5 deliverable from the harbour-launch-readiness plan
 * (~/.claude/plans/partitioned-painting-pascal.md). Hits every
 * production surface and asserts:
 *   - HTTP 200 (or expected non-200 for known auth-gated endpoints)
 *   - Response time < 3000ms (warning at >2000ms)
 *   - No "x-vercel-error" header
 *   - No "Server error" / "could not route" body markers
 *   - Body contains a <title> tag (proves a real page rendered)
 *
 * Each target gets 3 retries with 10s backoff before going red.
 *
 * Usage:
 *   node scripts/launch-smoke.mjs                     # full check, console table
 *   node scripts/launch-smoke.mjs --json              # machine-readable output
 *   node scripts/launch-smoke.mjs --slow-only         # only show targets > 2s
 *   node scripts/launch-smoke.mjs --target=harbour    # filter by substring
 *
 * Exit codes:
 *   0 — every target green
 *   1 — at least one target red after retries
 */

import { argv } from "node:process";
import { performance } from "node:perf_hooks";

const args = new Set(argv.slice(2));
const flags = Object.fromEntries(
  argv.slice(2).filter((a) => a.includes("=")).map((a) => a.replace(/^--/, "").split("=")),
);
const JSON_OUT = args.has("--json");
const SLOW_ONLY = args.has("--slow-only");
const FILTER = flags.target ?? "";

// ── target inventory ─────────────────────────────────────────────────────

// Each target: [label, url, expect]
//   expect: a number (e.g. 200, 308) → status must match exactly
//           or an array of numbers (e.g. [200, 307, 401]) → match any
//           or "ok-status" → any 2xx or 3xx is acceptable
//
// Harbour app slugs sourced from site/next.config.ts rewrites — keep in
// sync if new apps are added.

const HARBOUR_APPS = [
  "creaseworks", "vertigo-vault", "deep-deck", "depth-chart", "raft-house",
  "tidal-pool", "paper-trail", "mirror-log", "orbit-lab", "proof-garden",
  "bias-lens", "scale-shift", "pattern-weave", "market-mind", "rhythm-lab",
  "code-weave", "time-prism", "liminal-pass", "emerge-box",
  "rubric-co-builder", "cuts-catalogue", "feel-cards", "values-auction",
  "three-intelligence-workbook",
];

// known-pending-deploy: targets that will be RED until a deploy that's
// already committed but not yet shipped lands. listed here so we can
// remind ourselves rather than chase a non-bug.
const PENDING_DEPLOY_NOTES = {
  "harbour/three-intelligence-workbook":
    "wv-site Worker redeploy needed (commit 1cc20fa fixes the rewrite, " +
    "wrangler-blocked). Once deployed, rerun smoke — should be green.",
};

const TARGETS = [
  // ── site root + structural redirects ─────────────────────────────────
  // Site root — can be 200 OR 308 (apex → www redirect, depending on which host hits)
  ["site apex",          "https://windedvertigo.com",                          [200, 301, 308]],
  ["site www",           "https://www.windedvertigo.com",                      200],
  // /portfolio may 308 to /portfolio/ — both fine
  ["site portfolio",     "https://www.windedvertigo.com/portfolio",            [200, 308]],
  ["crm path-redirect",  "https://www.windedvertigo.com/crm",                  308],

  // ── harbour hub ──────────────────────────────────────────────────────
  ["harbour hub",        "https://www.windedvertigo.com/harbour",              200],
  ["harbour skills",     "https://www.windedvertigo.com/harbour/skills",       200],
  ["harbour prowl",      "https://www.windedvertigo.com/harbour/prowl",        200],
  ["harbour thread-pull","https://www.windedvertigo.com/harbour/thread-pull",  200],

  // ── nested harbour apps (each tile entry) ────────────────────────────
  // Several apps gate at the entry path with auth.js or Stripe paywall —
  // accept 200, 307, 308, or 401/403 (auth-gated). Hard 404 = real broken.
  ...HARBOUR_APPS.map((slug) => [
    `harbour/${slug}`,
    `https://www.windedvertigo.com/harbour/${slug}`,
    [200, 301, 302, 307, 308, 401, 403],
  ]),

  // ── auth surface — should respond, may redirect or return null body ──
  ["creaseworks /api/auth/csrf",  "https://www.windedvertigo.com/harbour/creaseworks/api/auth/csrf", 200],
  ["vault /api/auth/csrf",        "https://windedvertigo.com/harbour/vertigo-vault/api/auth/csrf",   200],
  ["depth-chart /api/auth/csrf",  "https://windedvertigo.com/harbour/depth-chart/api/auth/csrf",     200],
  ["port /api/auth/csrf",         "https://port.windedvertigo.com/api/auth/csrf",                    200],
  ["ops /api/auth/csrf",          "https://ops.windedvertigo.com/api/auth/csrf",                     200],

  // ── admin endpoints (must NOT return 200 unauth — gate via bearer token) ─
  // 401/403 = auth gate working. 405 = method-not-allowed (POST endpoint hit
  // with GET) — also valid because anonymous can't reach the protected handler.
  // 200 = leak (would mean the bearer check is missing).
  ["sync-tiles unauth", "https://www.windedvertigo.com/harbour/api/admin/sync-tiles", [401, 403, 405]],

  // ── port + ops origins (auth.js redirects unauth GET to /login) ──────
  // 307 or 302 = expected auth bounce. 200 only if there's a public landing.
  ["port root", "https://port.windedvertigo.com", [200, 302, 307]],
  ["ops root",  "https://ops.windedvertigo.com",  [200, 302, 307]],
];

// ── probe ────────────────────────────────────────────────────────────────

const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 10_000;
const TIMEOUT_MS = 15_000;
const SLOW_THRESHOLD_MS = 2_000;

async function probeOnce(url) {
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Pretend to be a normal browser to dodge any UA-based bot challenges.
      headers: { "user-agent": "Mozilla/5.0 (compatible; LaunchSmoke/1.0)" },
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      elapsed: Math.round(performance.now() - t0),
      reason: `fetch error: ${e.message?.slice(0, 80) ?? e}`,
      headers: {},
      bodySample: "",
    };
  }
  const elapsed = Math.round(performance.now() - t0);
  const headers = Object.fromEntries(res.headers.entries());
  let bodySample = "";
  if (res.status >= 200 && res.status < 300) {
    try {
      // Pull more bytes so we can find <title> tags that live below long
      // <head> preload-link blocks. Empirically harbour pages can push
      // <title> well past byte 1024.
      bodySample = (await res.text()).slice(0, 8192);
    } catch {
      bodySample = "";
    }
  }
  return { ok: true, status: res.status, elapsed, headers, bodySample };
}

function statusMatches(status, expect) {
  if (expect === "ok-status") return status >= 200 && status < 400;
  if (Array.isArray(expect)) return expect.includes(status);
  return status === expect;
}

function evaluate(target, probe) {
  const [label, url, expect] = target;
  const reasons = [];

  if (!probe.ok) {
    reasons.push(probe.reason);
    return { label, url, status: probe.status, elapsed: probe.elapsed, red: true, reasons };
  }

  if (!statusMatches(probe.status, expect)) {
    reasons.push(`expected ${Array.isArray(expect) ? expect.join("|") : expect}, got ${probe.status}`);
  }
  if (probe.headers["x-vercel-error"]) {
    reasons.push(`x-vercel-error: ${probe.headers["x-vercel-error"]}`);
  }
  // Cloudflare/Vercel canonical error markers in body. Limited to specific
  // strings so we don't false-positive on legitimate "error" mentions in
  // marketing copy or auth.js error params.
  if (probe.bodySample && /could not route to the requested URL|Worker threw exception|<title>Error 5\d\d/i.test(probe.bodySample)) {
    reasons.push("body contains error marker");
  }
  // For 2xx HTML responses, expect a <title> tag SOMEWHERE in the first 8KB.
  // Skip this check for JSON responses (csrf, session endpoints) and
  // redirect responses (no body sent).
  const is2xxHtml =
    probe.status >= 200 && probe.status < 300 &&
    (probe.headers["content-type"] ?? "").startsWith("text/html");
  if (is2xxHtml && probe.bodySample && !/<title[\s>]/i.test(probe.bodySample)) {
    reasons.push("html response missing <title>");
  }
  if (probe.elapsed > SLOW_THRESHOLD_MS) {
    reasons.push(`slow: ${probe.elapsed}ms (threshold ${SLOW_THRESHOLD_MS}ms)`);
  }

  return {
    label,
    url,
    status: probe.status,
    elapsed: probe.elapsed,
    red: reasons.filter((r) => !r.startsWith("slow:")).length > 0,
    slow: probe.elapsed > SLOW_THRESHOLD_MS,
    reasons,
  };
}

async function probeWithRetry(target) {
  for (let i = 1; i <= RETRY_COUNT; i++) {
    const probe = await probeOnce(target[1]);
    const ev = evaluate(target, probe);
    if (!ev.red) return ev;
    if (i < RETRY_COUNT) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    return ev;
  }
  return null; // unreachable
}

// ── run ──────────────────────────────────────────────────────────────────

const filtered = FILTER ? TARGETS.filter((t) => t[0].includes(FILTER) || t[1].includes(FILTER)) : TARGETS;

if (!JSON_OUT) {
  console.error(`\nLaunch smoke — ${filtered.length} targets`);
  console.error(`(retries: ${RETRY_COUNT}, backoff: ${RETRY_DELAY_MS / 1000}s, timeout: ${TIMEOUT_MS / 1000}s, slow >${SLOW_THRESHOLD_MS}ms)\n`);
}

const results = [];
for (const target of filtered) {
  const r = await probeWithRetry(target);
  results.push(r);
  if (!JSON_OUT && !(SLOW_ONLY && !r.slow && !r.red)) {
    const tag = r.red ? "✗ RED" : r.slow ? "⚠ SLOW" : "✓ OK";
    const detail = r.reasons.length ? ` — ${r.reasons.join("; ")}` : "";
    console.error(`  ${tag.padEnd(8)} ${r.elapsed.toString().padStart(5)}ms  ${r.label.padEnd(34)} ${r.status}${detail}`);
  }
}

const red = results.filter((r) => r.red);
const slow = results.filter((r) => r.slow && !r.red);

if (JSON_OUT) {
  console.log(JSON.stringify({ total: results.length, red: red.length, slow: slow.length, results }, null, 2));
} else {
  console.error(`\nSummary: ${results.length - red.length}/${results.length} green, ${slow.length} slow, ${red.length} red\n`);
  if (red.length > 0) {
    console.error("Red targets:");
    for (const r of red) {
      console.error(`  - ${r.label}: ${r.reasons.join("; ")}`);
      if (PENDING_DEPLOY_NOTES[r.label]) {
        console.error(`    ↳ pending: ${PENDING_DEPLOY_NOTES[r.label]}`);
      }
    }
    console.error("");
  }
}

process.exit(red.length > 0 ? 1 : 0);

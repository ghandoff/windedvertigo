#!/usr/bin/env node
/**
 * Harbour launch-readiness security audit.
 *
 * Phase 4a deliverable from the harbour-launch-readiness plan
 * (~/.claude/plans/partitioned-painting-pascal.md). Read-only probes
 * — no remediation, no state mutation. Run with:
 *
 *   node scripts/security-audit.mjs > docs/security/launch-audit-$(date +%Y-%m-%d).md
 *
 * Optional flags (mostly for quick re-runs of subsections):
 *   --skip-rate-limit   Skip the rate-limit fuzz (it spends ~10s + 50 reqs)
 *   --target=<host>     Override default targets (comma-separated origins)
 *
 * Findings are tagged:
 *   - must-fix      ship-blocker; must close before public launch
 *   - should-fix    measurable improvement; do before launch if possible
 *   - nice-to-have  defensible posture, not material to launch
 */

import { argv } from "node:process";
import { performance } from "node:perf_hooks";

const args = new Set(argv.slice(2));
const flags = Object.fromEntries(
  argv
    .slice(2)
    .filter((a) => a.startsWith("--") && a.includes("="))
    .map((a) => a.replace(/^--/, "").split("=")),
);

const SKIP_RATE_LIMIT = args.has("--skip-rate-limit");

// Origins to probe. Each is a tuple [label, baseURL, requireSession?].
// requireSession=false because we audit the public surface — header
// emission, redirects, etc. — not authenticated endpoints.
const TARGETS = (flags.target ?? "").length
  ? flags.target.split(",").map((u, i) => [`target${i}`, u, false])
  : [
      ["site (root)",  "https://www.windedvertigo.com",                       false],
      ["harbour hub",  "https://www.windedvertigo.com/harbour",                false],
      ["creaseworks",  "https://www.windedvertigo.com/harbour/creaseworks",    false],
      ["vault",        "https://windedvertigo.com/harbour/vertigo-vault",      false],
      ["depth-chart",  "https://windedvertigo.com/harbour/depth-chart",        false],
      ["port",         "https://port.windedvertigo.com",                       false],
      ["ops",          "https://ops.windedvertigo.com",                        false],
    ];

// ─── output helpers ────────────────────────────────────────────────────

const lines = [];
const findings = []; // { severity, area, label, detail }

function md(s = "") { lines.push(s); }
function record(severity, area, label, detail) {
  findings.push({ severity, area, label, detail });
}

// ─── probe primitives ──────────────────────────────────────────────────

async function head(url, opts = {}) {
  const t0 = performance.now();
  const r = await fetch(url, { method: "GET", redirect: "manual", ...opts });
  const elapsed = Math.round(performance.now() - t0);
  return {
    status: r.status,
    headers: Object.fromEntries(r.headers.entries()),
    elapsed,
  };
}

// ─── probe 1: security headers per origin ──────────────────────────────

const REQUIRED_HEADERS = {
  "strict-transport-security": "must-fix",
  "x-frame-options": "should-fix",
  "x-content-type-options": "should-fix",
  "referrer-policy": "should-fix",
  "permissions-policy": "should-fix",
  "content-security-policy": "must-fix",
};

async function auditHeaders() {
  md("## 1. Security headers");
  md("");
  md("Every public origin should emit the following headers. `must-fix` items block launch.");
  md("");
  md("| origin | HSTS | XFO | XCTO | Referrer | Permissions | CSP |");
  md("|---|---|---|---|---|---|---|");

  for (const [label, base] of TARGETS) {
    let row = `| ${label} `;
    let probe;
    try {
      probe = await head(base);
    } catch (e) {
      row += "| ERR ".repeat(6) + "|";
      md(row);
      record("must-fix", "headers", label, `unreachable: ${e.message}`);
      continue;
    }
    const h = probe.headers;
    for (const [name, sev] of Object.entries(REQUIRED_HEADERS)) {
      if (h[name]) {
        row += "| ✓ ";
      } else {
        row += "| ✗ ";
        record(sev, "headers", label, `missing ${name}`);
      }
    }
    row += "|";
    md(row);
  }

  md("");
}

// ─── probe 2: CSP analysis ─────────────────────────────────────────────

async function auditCSP() {
  md("## 2. CSP analysis");
  md("");
  md("Reports unsafe directives and missing protective directives per origin.");
  md("");
  md("| origin | unsafe-inline (script) | unsafe-inline (style) | frame-ancestors | upgrade-insecure-requests |");
  md("|---|---|---|---|---|");

  for (const [label, base] of TARGETS) {
    let row = `| ${label} `;
    let probe;
    try {
      probe = await head(base);
    } catch (e) {
      row += "| - ".repeat(4) + "|";
      md(row);
      continue;
    }
    const csp = probe.headers["content-security-policy"];
    if (!csp) {
      row += "| (no CSP) ".repeat(4) + "|";
      md(row);
      continue;
    }
    const scriptHasUnsafeInline = /script-src[^;]*'unsafe-inline'/i.test(csp);
    const styleHasUnsafeInline = /style-src[^;]*'unsafe-inline'/i.test(csp);
    const hasFrameAncestors = /frame-ancestors/i.test(csp);
    const hasUpgrade = /upgrade-insecure-requests/i.test(csp);

    row += `| ${scriptHasUnsafeInline ? "⚠ yes" : "✓ no"} `;
    row += `| ${styleHasUnsafeInline ? "⚠ yes" : "✓ no"} `;
    row += `| ${hasFrameAncestors ? "✓ set" : "✗ missing"} `;
    row += `| ${hasUpgrade ? "✓ set" : "✗ missing"} |`;
    md(row);

    if (scriptHasUnsafeInline) record("should-fix", "csp", label, "script-src has 'unsafe-inline'");
    if (!hasFrameAncestors) record("should-fix", "csp", label, "missing frame-ancestors directive (defense-in-depth alongside X-Frame-Options)");
    if (!hasUpgrade) record("nice-to-have", "csp", label, "missing upgrade-insecure-requests");
  }

  md("");
}

// ─── probe 3: HSTS preload eligibility ─────────────────────────────────

async function auditHSTS() {
  md("## 3. HSTS preload eligibility");
  md("");
  md("HSTS must be `max-age=31536000` (≥1 year), `includeSubDomains`, and `preload`.");
  md("");
  md("| origin | max-age | includeSubDomains | preload |");
  md("|---|---|---|---|");

  for (const [label, base] of TARGETS) {
    let probe;
    try { probe = await head(base); } catch { continue; }
    const hsts = probe.headers["strict-transport-security"] ?? "";
    const m = hsts.match(/max-age=(\d+)/);
    const maxAge = m ? Number(m[1]) : 0;
    const hasISD = /includeSubDomains/i.test(hsts);
    const hasPreload = /preload/i.test(hsts);

    md(`| ${label} | ${maxAge.toLocaleString()} | ${hasISD ? "✓" : "✗"} | ${hasPreload ? "✓" : "✗"} |`);

    if (maxAge < 31536000) record("must-fix", "hsts", label, `max-age=${maxAge} < 1 year`);
    if (!hasISD) record("should-fix", "hsts", label, "missing includeSubDomains");
    if (!hasPreload) record("nice-to-have", "hsts", label, "missing preload (only matters if submitted to hstspreload.org)");
  }

  md("");
}

// ─── probe 4: rate-limit fuzz on auth endpoints ─────────────────────────

async function auditRateLimit() {
  if (SKIP_RATE_LIMIT) {
    md("## 4. Rate-limit fuzz (SKIPPED)");
    md("");
    md("Re-run without `--skip-rate-limit` to populate this section.");
    md("");
    return;
  }

  md("## 4. Rate-limit fuzz");
  md("");
  md("50 unauthenticated requests at 5/sec to each auth/admin endpoint. Expect 429 or sub-200ms reject.");
  md("");
  md("| target | total | 200 | 401/403 | 429 | other | mean ms |");
  md("|---|---|---|---|---|---|---|");

  const targets = [
    ["harbour signin",   "https://www.windedvertigo.com/harbour/login"],
    ["harbour csrf",     "https://www.windedvertigo.com/harbour/api/auth/csrf"],
    ["creaseworks csrf", "https://www.windedvertigo.com/harbour/creaseworks/api/auth/csrf"],
    ["depth-chart csrf", "https://windedvertigo.com/harbour/depth-chart/api/auth/csrf"],
    ["port signin",      "https://port.windedvertigo.com/api/auth/signin"],
    ["sync-tiles admin", "https://www.windedvertigo.com/harbour/api/admin/sync-tiles"],
  ];

  for (const [label, url] of targets) {
    const counts = { 200: 0, 401: 0, 403: 0, 429: 0, other: 0 };
    const elapsedSamples = [];
    for (let i = 0; i < 50; i++) {
      try {
        const probe = await head(url, { method: i % 2 === 0 ? "GET" : "POST" });
        elapsedSamples.push(probe.elapsed);
        if (probe.status === 200) counts[200]++;
        else if (probe.status === 401) counts[401]++;
        else if (probe.status === 403) counts[403]++;
        else if (probe.status === 429) counts[429]++;
        else counts.other++;
      } catch {
        counts.other++;
      }
      // 5/sec
      await new Promise((r) => setTimeout(r, 200));
    }
    const mean = elapsedSamples.length ? Math.round(elapsedSamples.reduce((a, b) => a + b, 0) / elapsedSamples.length) : "—";
    const auth = (counts[401] + counts[403]);
    md(`| ${label} | 50 | ${counts[200]} | ${auth} | ${counts[429]} | ${counts.other} | ${mean} |`);

    // Findings: admin endpoints should NEVER return 200 unauth, signin endpoints should rate-limit
    if (label.includes("admin") && counts[200] > 0) {
      record("must-fix", "rate-limit", label, `admin endpoint returned 200 to unauth requests (${counts[200]}/50)`);
    }
    if (label.includes("signin") && counts[429] === 0 && counts[200] + counts[401] + counts[403] > 30) {
      record("should-fix", "rate-limit", label, `no rate-limiting observed across 50 unauth requests at 5 req/sec`);
    }
  }

  md("");
}

// ─── probe 5: open redirect / SSRF on auth callback URL params ──────────

async function auditCallbacks() {
  md("## 5. Callback URL allowlist");
  md("");
  md("Auth.js callback handlers should reject external `callbackUrl` values (open-redirect risk).");
  md("");

  const tests = [
    ["harbour", "https://www.windedvertigo.com/harbour/api/auth/signin/google?callbackUrl=https://evil.example.com"],
    ["creaseworks", "https://www.windedvertigo.com/harbour/creaseworks/api/auth/signin/google?callbackUrl=https://evil.example.com"],
    ["depth-chart", "https://windedvertigo.com/harbour/depth-chart/api/auth/signin/google?callbackUrl=https://evil.example.com"],
  ];

  md("| target | status | location | safe? |");
  md("|---|---|---|---|");

  for (const [label, url] of tests) {
    let probe;
    try { probe = await head(url); } catch { continue; }
    const loc = probe.headers["location"] ?? "";
    const externalRedirect = /^https?:\/\/(?!www\.windedvertigo\.com|windedvertigo\.com|port\.windedvertigo\.com)/.test(loc);
    md(`| ${label} | ${probe.status} | ${loc.slice(0, 80)} | ${externalRedirect ? "⚠ EXTERNAL" : "✓"} |`);
    if (externalRedirect) record("must-fix", "callback", label, `redirected to external host: ${loc.slice(0, 80)}`);
  }

  md("");
}

// ─── probe 6: input-validation on public POSTs ─────────────────────────

async function auditInputValidation() {
  md("## 6. Input-validation probe");
  md("");
  md("Public POST endpoints should reject malformed JSON / oversize bodies with 400, not 500.");
  md("");

  const tests = [
    ["harbour signin (resend)",   "https://www.windedvertigo.com/harbour/api/auth/signin/resend"],
    ["creaseworks signin (resend)", "https://www.windedvertigo.com/harbour/creaseworks/api/auth/signin/resend"],
  ];

  md("| target | malformed JSON | oversize body |");
  md("|---|---|---|");

  for (const [label, url] of tests) {
    const malformedStatus = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    }).then((r) => r.status).catch(() => "ERR");
    const oversizeStatus = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x".repeat(1024 * 1024) }),
    }).then((r) => r.status).catch(() => "ERR");

    md(`| ${label} | ${malformedStatus} | ${oversizeStatus} |`);

    if (malformedStatus >= 500) record("should-fix", "input-validation", label, `500 on malformed JSON`);
    if (oversizeStatus >= 500) record("should-fix", "input-validation", label, `500 on 1MB body — should reject earlier`);
  }

  md("");
}

// ─── header ────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
md(`# Harbour launch-readiness security audit — ${today}`);
md("");
md(`Generated by \`scripts/security-audit.mjs\` at ${new Date().toISOString()}.`);
md("");
md("**Severity legend:**");
md("- 🛑 `must-fix` — ship-blocker before public launch");
md("- ⚠️  `should-fix` — measurable improvement; close if possible");
md("- ℹ️  `nice-to-have` — defensible posture, not material to launch");
md("");

// ─── run all audits ────────────────────────────────────────────────────

await auditHeaders();
await auditCSP();
await auditHSTS();
await auditRateLimit();
await auditCallbacks();
await auditInputValidation();

// ─── findings summary ──────────────────────────────────────────────────

md("---");
md("");
md("## Findings summary");
md("");

const bySev = { "must-fix": [], "should-fix": [], "nice-to-have": [] };
for (const f of findings) bySev[f.severity].push(f);

for (const sev of ["must-fix", "should-fix", "nice-to-have"]) {
  const list = bySev[sev];
  md(`### ${sev} (${list.length})`);
  md("");
  if (list.length === 0) { md("_none_"); md(""); continue; }
  for (const f of list) md(`- **${f.area}** — ${f.label}: ${f.detail}`);
  md("");
}

md("## Run metadata");
md("");
md(`- Duration: see process timestamps`);
md(`- Targets: ${TARGETS.map(([l]) => l).join(", ")}`);
md(`- Skip rate-limit: ${SKIP_RATE_LIMIT}`);

console.log(lines.join("\n"));

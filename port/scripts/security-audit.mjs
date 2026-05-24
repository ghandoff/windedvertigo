#!/usr/bin/env node
/**
 * port security header audit
 *
 * Checks required security headers on the public-facing endpoints.
 * 🔴 = critical missing header (real security gap)
 * 🟡 = recommended but not blocking
 *
 * Usage:  node port/scripts/security-audit.mjs
 *         BASE=https://port.windedvertigo.com node port/scripts/security-audit.mjs
 */

const BASE = process.env.BASE ?? "https://port.windedvertigo.com";

const REQUIRED = [
  { header: "x-frame-options",          expect: /DENY|SAMEORIGIN/i,   critical: true  },
  { header: "x-content-type-options",   expect: /nosniff/i,           critical: true  },
  { header: "referrer-policy",          expect: /.+/,                  critical: false },
  { header: "strict-transport-security", expect: /max-age=\d+/i,      critical: true  },
  { header: "content-security-policy",  expect: /.+/,                  critical: false },
  { header: "permissions-policy",       expect: /.+/,                  critical: false },
];

let criticalFail = 0;
let warnFail = 0;

for (const url of [`${BASE}/login`, `${BASE}/api/version`]) {
  console.log(`\n── ${url}`);
  const res = await fetch(url, { redirect: "manual" });
  for (const { header, expect: pattern, critical } of REQUIRED) {
    const val = res.headers.get(header);
    const ok = val && pattern.test(val);
    const icon = ok ? "✅" : (critical ? "🔴" : "🟡");
    if (!ok) { if (critical) criticalFail++; else warnFail++; }
    console.log(`  ${icon}  ${header}: ${val ?? "(missing)"}`);
  }
}

console.log("");
console.log("─".repeat(60));
if (criticalFail === 0 && warnFail === 0) {
  console.log("Security: all headers present ✅");
} else {
  if (criticalFail > 0) console.log(`Security: ${criticalFail} critical header(s) missing 🔴`);
  if (warnFail > 0)     console.log(`Security: ${warnFail} recommended header(s) missing 🟡`);
}
process.exit(criticalFail > 0 ? 1 : 0);

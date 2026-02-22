#!/usr/bin/env node
/**
 * a11y-audit.mjs — automated accessibility audit using @axe-core/cli
 *
 * Prerequisites:
 *   npm install          (installs @axe-core/cli dev dependency)
 *   npm run dev          (start the dev server on localhost:3000)
 *
 * Usage:
 *   npm run test:a11y                     # audit all default pages
 *   node scripts/a11y-audit.mjs /login    # audit a single path
 *
 * The script runs axe against each page and reports WCAG 2.1 AA violations.
 * Exit code 0 = all pages pass, 1 = at least one violation found.
 */

import { execSync } from "child_process";

const BASE = process.env.BASE_URL || "http://localhost:3000";

/* pages to audit — add new routes here as you build them */
const DEFAULT_PATHS = [
  "/",
  "/login",
  "/sampler",
];

const paths = process.argv.length > 2
  ? process.argv.slice(2)
  : DEFAULT_PATHS;

let failures = 0;

for (const p of paths) {
  const url = `${BASE}${p}`;
  console.log(`\n──────────────────────────────────────`);
  console.log(`auditing ${url}`);
  console.log(`──────────────────────────────────────`);

  try {
    execSync(
      `npx axe ${url} --tags wcag2a,wcag2aa,wcag21aa --reporter json`,
      { stdio: "pipe", timeout: 30_000 }
    );
    console.log("  ✓ no violations");
  } catch (err) {
    /* axe exits non-zero when violations are found */
    const output = err.stdout?.toString() || "";
    try {
      const results = JSON.parse(output);
      if (Array.isArray(results) && results.length > 0) {
        const violations = results[0]?.violations || [];
        if (violations.length === 0) {
          console.log("  ✓ no violations");
          continue;
        }
        failures += violations.length;
        for (const v of violations) {
          console.log(`  ✗ [${v.impact}] ${v.id}: ${v.description}`);
          console.log(`    help: ${v.helpUrl}`);
          for (const node of v.nodes.slice(0, 3)) {
            console.log(`    → ${node.target?.[0] || node.html?.slice(0, 80)}`);
          }
          if (v.nodes.length > 3) {
            console.log(`    … and ${v.nodes.length - 3} more`);
          }
        }
      }
    } catch {
      /* non-JSON output — probably a connection error */
      console.log(`  ✗ audit failed: ${err.message?.slice(0, 120)}`);
      failures++;
    }
  }
}

console.log(`\n══════════════════════════════════════`);
if (failures === 0) {
  console.log("all pages passed WCAG 2.1 AA audit ✓");
} else {
  console.log(`${failures} violation(s) found — see above`);
}
console.log(`══════════════════════════════════════\n`);

process.exit(failures > 0 ? 1 : 0);

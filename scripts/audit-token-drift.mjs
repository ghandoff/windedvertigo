#!/usr/bin/env node
/**
 * audit-token-drift — is windedvertigo's design-token copies in sync with the
 * harbour-apps canonical? Runs the same comparison as `npm run audit:tokens`
 * (sync-tokens.mjs --check) and, with `--report`, publishes the result to Opsy
 * so it lights up on /ops.
 *
 * The check can only run where BOTH repos exist (a dev machine or a CI job that
 * checks out both) — the CF Worker can't diff the sibling repo at runtime. So
 * this pushes the FACT into opsy_memory (key `design-token-sync`); a frequent
 * Opsy checker re-emits it into opsy_health_checks to keep /ops fresh.
 *
 *   node scripts/audit-token-drift.mjs            # print status, exit 1 on drift
 *   node scripts/audit-token-drift.mjs --report   # also POST to Opsy
 *     env: OPSY_URL (default https://port.windedvertigo.com), OPSY_TOKEN (=CMO_API_TOKEN)
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Reuse sync-tokens.mjs --check as the single source of drift truth.
const res = spawnSync("node", [join(HERE, "sync-tokens.mjs"), "--check"], { encoding: "utf8" });
const out = (res.stdout || "") + (res.stderr || "");
process.stdout.write(out);

if (res.status === 2) {
  // canonical missing (harbour-apps not checked out) — can't judge; don't report a false green.
  console.error("✗ cannot audit: harbour-apps canonical not found.");
  process.exit(2);
}

const driftedFiles = out
  .split("\n")
  .filter((l) => l.includes("✗ DRIFT"))
  .map((l) => l.replace(/.*✗ DRIFT\s+/, "").trim());
const inSync = res.status === 0;
const status = inSync ? "green" : "red";

if (process.argv.includes("--report")) {
  const base = process.env.OPSY_URL || "https://port.windedvertigo.com";
  const token = process.env.OPSY_TOKEN;
  if (!token) {
    console.error("✗ --report needs OPSY_TOKEN (= CMO_API_TOKEN) in env.");
    process.exit(2);
  }
  const value = JSON.stringify({
    status,
    drift_count: driftedFiles.length,
    files: driftedFiles,
    reported_at: new Date().toISOString(),
    source: "audit-token-drift",
  });
  const r = await fetch(`${base}/api/opsy/memory`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ key: "design-token-sync", value, updated_by: "audit-token-drift" }),
  });
  if (!r.ok) {
    console.error(`✗ report POST failed: HTTP ${r.status} ${await r.text().catch(() => "")}`.slice(0, 200));
    process.exit(1);
  }
  console.log(`✓ reported to Opsy: design-token-sync = ${status}${driftedFiles.length ? ` (${driftedFiles.length} drifted)` : ""}`);
}

process.exit(inSync ? 0 : 1);

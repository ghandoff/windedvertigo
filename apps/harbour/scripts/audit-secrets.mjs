#!/usr/bin/env node
// Audit every rotated secret across every destination (Vercel + CF Workers + local
// .env.local files). Reports drift WITHOUT printing any secret values or prefixes.
//
// Usage: node scripts/audit-secrets.mjs
//
// What it produces:
//   - For each secret: which local copies exist, which probe valid (where probe-able)
//   - For each secret: which Vercel projects + CF Workers have it, with timestamps
//   - A drift table identifying destinations that need propagation
//
// Read-only — never writes anything. Safe to run anytime.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { glob } from "node:fs/promises";

const HOME = homedir();

// ── Probe definitions: per-secret API call to test value validity ────────
// Each probe takes (value, siblingEnv) and returns true if the value is valid,
// false if invalid, null if unprobeable. siblingEnv is the parsed .env.local
// the value came from — useful for OAuth refresh-token probes that need
// client_id/secret from the same env scope.
const PROBES = {
  RESEND_API_KEY: async (key) => {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    }).catch(() => null);
    return r ? r.status === 200 : null;
  },
  NOTION_TOKEN: async (key) => {
    const r = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Notion-Version": "2022-06-28",
      },
    }).catch(() => null);
    return r ? r.status === 200 : null;
  },
  STRIPE_SECRET_KEY: async (key) => {
    const r = await fetch("https://api.stripe.com/v1/customers?limit=1", {
      headers: { Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` },
    }).catch(() => null);
    return r ? r.status === 200 : null;
  },
  // OAuth refresh-token probe: port's invoice processor uses GMAIL_CLIENT_ID
  // + GMAIL_CLIENT_SECRET (a separate OAuth client from GOOGLE_CLIENT_ID, which
  // is for app sign-in). Probe fails (returns null) if the GMAIL_-prefixed
  // siblings aren't present. POST to Google's token endpoint with the refresh
  // token; expect 200 (fresh access_token returned) vs 400 invalid_grant.
  GMAIL_REFRESH_TOKEN: async (refreshToken, siblingEnv) => {
    const clientId = siblingEnv?.GMAIL_CLIENT_ID;
    const clientSecret = siblingEnv?.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null; // can't probe without siblings
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).catch(() => null);
    return r ? r.status === 200 : null;
  },
  // Non-probeable secrets — can only check presence + length-equality across copies
  GOOGLE_CLIENT_SECRET: null,
  GOOGLE_CLIENT_ID: null, // public ID, not a secret per se
  LINKEDIN_CLIENT_SECRET: null,
  LINKEDIN_CLIENT_ID: null,
  R2_ACCESS_KEY_ID: null,
  R2_SECRET_ACCESS_KEY: null,
  AUTH_SECRET: null, // length-equality only; mismatch = SSO break
  STRIPE_WEBHOOK_SECRET: null,
  RESEND_WEBHOOK_SECRET: null, // HMAC secret for Resend webhook signatures; no API to probe
  BLUESKY_APP_PASSWORD: null,
  BLUESKY_HANDLE: null,
  // CRON_SECRET intentionally NOT included — it's per-app by design (each app
  // validates its own env var against its own cron callbacks). Length mismatch
  // across apps is expected, not drift.
  // ANTHROPIC_API_KEY intentionally NOT included — port migrated to AI Gateway
  // (uses ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL). The stale ANTHROPIC_API_KEY
  // value in port/.env.local is dead code; production uses the AI Gateway path.
};

// ── Step 1: Harvest local .env.local files ───────────────────────────────
async function findEnvFiles() {
  const roots = [
    `${HOME}/Projects/harbour-apps`,
    `${HOME}/Projects/windedvertigo`,
  ];
  const out = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for await (const f of glob("**/.env.local", { cwd: root })) {
      // Skip node_modules, build artifacts, .vercel pulled snapshots
      if (f.includes("node_modules") || f.includes(".next") || f.includes(".open-next") || f.includes(".vercel")) continue;
      out.push(join(root, f));
    }
  }
  return out;
}

function readEnvFile(path) {
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// ── Step 2: Vercel project envs ──────────────────────────────────────────
const VERCEL_DIRS = [
  ["creaseworks", `${HOME}/Projects/harbour-apps/apps/creaseworks`],
  ["vertigo-vault", `${HOME}/Projects/harbour-apps/apps/vertigo-vault`],
  ["depth-chart", `${HOME}/Projects/harbour-apps/apps/depth-chart`],
  ["harbour", `${HOME}/Projects/harbour-apps/apps/harbour`],
  ["port", `${HOME}/Projects/windedvertigo/port`],
  ["ops", `${HOME}/Projects/windedvertigo/ops`],
  ["ancestry", `${HOME}/Projects/windedvertigo/ancestry`],
  ["site", `${HOME}/Projects/windedvertigo/site`],
];

function vercelEnvList(cwd) {
  const r = spawnSync("vercel", ["env", "ls"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) return null;
  // Parse lines like: " RESEND_API_KEY    Encrypted    Production    2m ago"
  const lines = r.stdout.split("\n").slice(3); // skip header
  const out = {};
  for (const line of lines) {
    const m = line.trim().match(/^([A-Z][A-Z0-9_]*)\s+(\S+)\s+(\S(?:[^\s]|\s(?!\s))*?)\s{2,}(\S.*?)$/);
    if (!m) continue;
    const [, name, type, scope, age] = m;
    if (!out[name]) out[name] = [];
    out[name].push({ type: type.trim(), scope: scope.trim(), age: age.trim() });
  }
  return out;
}

// ── Step 3: CF Worker secrets (presence only) ────────────────────────────
const CF_WORKERS = [
  "wv-harbour-harbour",
  "wv-harbour-depth-chart",
  "wv-site",
  "wv-launch-smoke",
];

function wranglerSecretList(worker) {
  const cfToken = readFileSync(`${HOME}/.cf-token`, "utf8").trim();
  const r = spawnSync("npx", ["wrangler", "secret", "list", "--name", worker], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDFLARE_API_TOKEN: cfToken },
  });
  if (r.status !== 0) return null;
  const names = [];
  for (const m of r.stdout.matchAll(/"name":\s*"([^"]+)"/g)) names.push(m[1]);
  return names;
}

// ── Step 4: Audit each secret ────────────────────────────────────────────
async function audit() {
  const envFiles = await findEnvFiles();
  console.log(`scanning ${envFiles.length} local .env.local files…`);

  // Collect per-secret: which files have it + length + probe result
  // Also stash the file's full env so probes that need siblings (e.g. GMAIL
  // refresh-token needs GOOGLE_CLIENT_ID + _SECRET) can access them.
  const localCopies = {};
  for (const file of envFiles) {
    const env = readEnvFile(file);
    for (const [name, value] of Object.entries(env)) {
      if (!(name in PROBES)) continue;
      localCopies[name] ??= [];
      localCopies[name].push({ file, length: value.length, value, siblingEnv: env });
    }
  }

  // Probe each value per secret. Dedup by (value + relevant siblings) — simpler
  // to just probe per-copy when siblings matter, since same-value-different-siblings
  // produces different validity (e.g. a refresh token paired with rotated vs stale
  // client_secret).
  for (const [name, copies] of Object.entries(localCopies)) {
    const probe = PROBES[name];
    if (!probe) {
      // Length-equality check only
      const lengths = [...new Set(copies.map((c) => c.length))];
      copies.forEach((c) => (c.probe = lengths.length === 1 ? "all-equal-length" : "length-mismatch"));
    } else {
      const seen = new Map();
      for (const c of copies) {
        // Dedup key includes value only (probes that don't use siblings can dedup
        // by value alone; probes that DO use siblings re-probe per copy intentionally).
        const usesSiblings = probe.length >= 2;
        const dedupKey = usesSiblings ? c.file : c.value;
        if (!seen.has(dedupKey)) seen.set(dedupKey, await probe(c.value, c.siblingEnv));
        c.probe = seen.get(dedupKey);
      }
    }
  }

  console.log(`scanning ${VERCEL_DIRS.length} Vercel projects…`);
  const vercelState = {};
  for (const [proj, cwd] of VERCEL_DIRS) {
    if (!existsSync(cwd)) {
      vercelState[proj] = { error: "dir not found" };
      continue;
    }
    const envs = vercelEnvList(cwd);
    vercelState[proj] = envs ?? { error: "vercel env ls failed" };
  }

  console.log(`scanning ${CF_WORKERS.length} CF Workers…`);
  const cfState = {};
  for (const worker of CF_WORKERS) {
    cfState[worker] = wranglerSecretList(worker);
  }

  return { localCopies, vercelState, cfState };
}

// ── Step 5: Render report ────────────────────────────────────────────────
function relPath(p) {
  return p.replace(HOME, "~").replace("/Projects/", "/");
}

function renderReport({ localCopies, vercelState, cfState }) {
  console.log("\n" + "═".repeat(78));
  console.log("SECRET AUDIT REPORT");
  console.log("═".repeat(78));

  for (const name of Object.keys(PROBES)) {
    const copies = localCopies[name] ?? [];
    const probeable = PROBES[name] !== null;
    console.log(`\n┌─ ${name} ${probeable ? "(probe-able)" : "(length-equality only)"}`);

    // Local copies
    if (copies.length === 0) {
      console.log(`│  no local .env.local copies found`);
    } else {
      for (const c of copies) {
        const status = probeable
          ? c.probe === true
            ? "✓ valid"
            : c.probe === false
              ? "✗ invalid"
              : "? unprobeable"
          : c.probe; // "all-equal-length" | "length-mismatch"
        console.log(`│  local: ${relPath(c.file)} [len=${c.length}] ${status}`);
      }
    }

    // Vercel destinations
    const vercelLines = [];
    for (const [proj, state] of Object.entries(vercelState)) {
      if (state.error) continue;
      const entries = state[name];
      if (!entries) continue;
      for (const e of entries) {
        vercelLines.push(`│  vercel: ${proj.padEnd(15)} ${e.scope.padEnd(35)} ${e.age}`);
      }
    }
    if (vercelLines.length) console.log(vercelLines.join("\n"));

    // CF Workers
    const cfLines = [];
    for (const [worker, names] of Object.entries(cfState)) {
      if (names && names.includes(name)) cfLines.push(`│  cf:     ${worker} (presence only — no timestamp)`);
    }
    if (cfLines.length) console.log(cfLines.join("\n"));

    console.log(`└─`);
  }

  // Drift summary
  console.log("\n" + "═".repeat(78));
  console.log("DRIFT SUMMARY (probe-able secrets)");
  console.log("═".repeat(78));
  let driftCount = 0;
  for (const name of Object.keys(PROBES)) {
    if (PROBES[name] === null) continue;
    const copies = localCopies[name] ?? [];
    const valid = copies.filter((c) => c.probe === true);
    const invalid = copies.filter((c) => c.probe === false);
    const unprobed = copies.filter((c) => c.probe === null);
    if (invalid.length === 0 && unprobed.length === 0) {
      console.log(`✓ ${name.padEnd(25)} all ${copies.length} local copies valid`);
    } else {
      driftCount++;
      console.log(`⚠ ${name.padEnd(25)} ${valid.length} valid / ${invalid.length} stale / ${unprobed.length} unprobed`);
      invalid.forEach((c) => console.log(`    stale: ${relPath(c.file)}`));
      unprobed.forEach((c) => console.log(`    unprobed (network/vendor down?): ${relPath(c.file)}`));
    }
  }

  console.log("\n" + "═".repeat(78));
  console.log("LENGTH-EQUALITY SUMMARY (non-probe-able secrets)");
  console.log("═".repeat(78));
  for (const name of Object.keys(PROBES)) {
    if (PROBES[name] !== null) continue;
    const copies = localCopies[name] ?? [];
    if (copies.length <= 1) {
      console.log(`  ${name.padEnd(25)} ${copies.length} local copy${copies.length === 1 ? " (no equality check possible)" : "ies"}`);
      continue;
    }
    const lengths = [...new Set(copies.map((c) => c.length))];
    if (lengths.length === 1) {
      console.log(`✓ ${name.padEnd(25)} all ${copies.length} copies same length (${lengths[0]})`);
    } else {
      driftCount++;
      console.log(`⚠ ${name.padEnd(25)} length mismatch — values likely diverged`);
      const byLen = {};
      copies.forEach((c) => (byLen[c.length] ??= []).push(c.file));
      for (const [len, files] of Object.entries(byLen)) {
        console.log(`    length ${len}: ${files.map(relPath).join(", ")}`);
      }
    }
  }

  console.log(`\n${driftCount === 0 ? "✓ no drift detected" : `⚠ ${driftCount} secret(s) need attention`}`);
}

await audit().then(renderReport).catch((e) => {
  console.error("audit failed:", e.message);
  process.exit(1);
});

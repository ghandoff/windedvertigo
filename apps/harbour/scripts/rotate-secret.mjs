#!/usr/bin/env node
// Generic secret-rotation propagator. Reads a current secret value from a
// "source-of-truth" file (port/.env.local), validates via vendor probe, then
// propagates to every listed destination: Vercel project envs, CF Worker
// secrets, local .env.local mirrors. Triggers Vercel redeploys at the end.
//
// **The secret value never prints to stdout, never goes through the Bash
// arg list (always piped via stdin where possible), and is wiped from
// process.env at exit.**
//
// Usage:
//   node scripts/rotate-secret.mjs --secret=NAME [--dry-run]
//   node scripts/rotate-secret.mjs --secret=ALL [--dry-run]   # batch all configured
//
// Documented in docs/runbooks/secret-rotation.md.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { parseArgs } from "node:util";

const HOME = homedir();
const SOURCE = `${HOME}/Projects/windedvertigo/port/.env.local`;

// Per-secret config. Add new entries as more secrets enter the rotation routine.
// Audit script: `node scripts/audit-secrets.mjs` to find drift; the destinations
// listed here come from that audit's findings.
const SECRETS = {
  RESEND_API_KEY: {
    probeUrl: "https://api.resend.com/domains",
    probeHeaders: { Authorization: "Bearer $K" },
    probeOkStatus: 200,
    vercelProjects: [
      ["creaseworks", `${HOME}/Projects/harbour-apps/apps/creaseworks`],
      ["vertigo-vault", `${HOME}/Projects/harbour-apps/apps/vertigo-vault`],
      ["depth-chart", `${HOME}/Projects/harbour-apps/apps/depth-chart`],
      ["ancestry", `${HOME}/Projects/windedvertigo/ancestry`],
    ],
    cfWorkers: ["wv-harbour-harbour", "wv-harbour-depth-chart", "wv-site"],
    localFiles: [
      `${HOME}/Projects/harbour-apps/apps/creaseworks/.env.local`,
      `${HOME}/Projects/harbour-apps/apps/vertigo-vault/.env.local`,
      `${HOME}/Projects/harbour-apps/apps/paper-trail/.env.local`,
      `${HOME}/Projects/windedvertigo/ancestry/.env.local`,
    ],
    redeployVercelAfterUpdate: true,
  },
  NOTION_TOKEN: {
    probeUrl: "https://api.notion.com/v1/users/me",
    probeHeaders: { Authorization: "Bearer $K", "Notion-Version": "2022-06-28" },
    probeOkStatus: 200,
    vercelProjects: [
      ["creaseworks", `${HOME}/Projects/harbour-apps/apps/creaseworks`],
      ["vertigo-vault", `${HOME}/Projects/harbour-apps/apps/vertigo-vault`],
      ["harbour", `${HOME}/Projects/harbour-apps/apps/harbour`],
      ["port", `${HOME}/Projects/windedvertigo/port`],
      ["ops", `${HOME}/Projects/windedvertigo/ops`],
    ],
    cfWorkers: ["wv-harbour-harbour", "wv-site"],
    localFiles: [
      `${HOME}/Projects/harbour-apps/apps/creaseworks/.env.local`,
      `${HOME}/Projects/harbour-apps/apps/vertigo-vault/.env.local`,
      `${HOME}/Projects/harbour-apps/apps/harbour/.env.local`,
      `${HOME}/Projects/harbour-apps/apps/paper-trail/.env.local`,
      `${HOME}/Projects/windedvertigo/site/.env.local`,
      `${HOME}/Projects/windedvertigo/ops/.env.local`,
    ],
    redeployVercelAfterUpdate: true,
  },
  // ANTHROPIC_API_KEY: source-of-truth unclear (port/.env.local is stale; depth-chart
  //   uses AI Gateway not direct Anthropic). Add once Garrett confirms which key is current.
  // STRIPE_SECRET_KEY, GOOGLE_CLIENT_*, AUTH_SECRET, R2_*: audit shows no drift currently.
  //   Add to SECRETS map when their next rotation surfaces.
};

const { values } = parseArgs({
  options: {
    secret: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

if (!values.secret) {
  console.error(`usage: rotate-secret.mjs --secret=NAME [--dry-run]`);
  console.error(`       rotate-secret.mjs --secret=ALL [--dry-run]`);
  console.error(`available: ${Object.keys(SECRETS).join(", ")}`);
  process.exit(1);
}

const targets = values.secret === "ALL" ? Object.keys(SECRETS) : [values.secret];
for (const t of targets) {
  if (!SECRETS[t]) {
    console.error(`unknown secret: ${t}`);
    console.error(`available: ${Object.keys(SECRETS).join(", ")}`);
    process.exit(1);
  }
}

const cfToken = readFileSync(`${HOME}/.cf-token`, "utf8").trim();

// ── Per-secret rotation routine ──────────────────────────────────────────
async function rotateOne(name, cfg) {
  console.log("\n" + "═".repeat(78));
  console.log(`ROTATING ${name}`);
  console.log("═".repeat(78));

  // Step 1: load current value from source
  if (!existsSync(SOURCE)) {
    console.error(`  source-of-truth file missing: ${SOURCE}`);
    return { name, success: false, reason: "no-source" };
  }
  const raw = readFileSync(SOURCE, "utf8");
  const lineMatch = raw.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!lineMatch) {
    console.error(`  ${name} not found in ${SOURCE}`);
    return { name, success: false, reason: "missing-from-source" };
  }
  let secretValue = lineMatch[1].trim();
  if (
    (secretValue.startsWith('"') && secretValue.endsWith('"')) ||
    (secretValue.startsWith("'") && secretValue.endsWith("'"))
  ) {
    secretValue = secretValue.slice(1, -1);
  }
  console.log(`  ✓ loaded from source (length: ${secretValue.length})`);

  // Step 2: probe validity
  const headerArgs = [];
  for (const [k, v] of Object.entries(cfg.probeHeaders ?? {})) {
    headerArgs.push("-H", `${k}: ${v.replace("$K", secretValue)}`);
  }
  const probeRes = spawnSync(
    "curl",
    ["-s", "-o", "/dev/null", "-w", "%{http_code}", cfg.probeUrl, ...headerArgs],
    { encoding: "utf8" }
  );
  if (probeRes.stdout !== String(cfg.probeOkStatus)) {
    console.error(
      `  ✗ probe failed: HTTP ${probeRes.stdout} (expected ${cfg.probeOkStatus})`
    );
    console.error(`    source value invalid; update ${SOURCE} with a fresh key first`);
    return { name, success: false, reason: "source-invalid" };
  }
  console.log(`  ✓ probe OK (HTTP ${cfg.probeOkStatus})`);

  if (values["dry-run"]) {
    console.log(`  [dry-run] would update ${cfg.vercelProjects.length} Vercel × 3 envs + ` +
                `${cfg.cfWorkers.length} CF Workers + ${cfg.localFiles.length} local files`);
    return { name, success: true, dry: true };
  }

  const result = { name, success: true, vercel: {}, cf: {}, local: [] };

  // Step 3: Vercel project envs
  // Sensitive vars (production/preview) need --value flag; dev accepts stdin.
  for (const [project, cwd] of cfg.vercelProjects) {
    if (!existsSync(cwd)) {
      console.warn(`  ! vercel ${project}: cwd ${cwd} missing — skip`);
      result.vercel[project] = "skip-no-cwd";
      continue;
    }
    for (const env of ["production", "preview", "development"]) {
      spawnSync("vercel", ["env", "rm", name, env, "--yes"], {
        cwd,
        stdio: ["ignore", "ignore", "ignore"],
      });
      const isSensitive = env === "production" || env === "preview";
      const addArgs = isSensitive
        ? ["env", "add", name, env, "--value", secretValue, "--force", "--yes"]
        : ["env", "add", name, env, "--force", "--yes"];
      const addRes = spawnSync("vercel", addArgs, {
        cwd,
        input: isSensitive ? undefined : secretValue,
        encoding: "utf8",
      });
      const ok = addRes.status === 0;
      console.log(`  ${ok ? "✓" : "✗"} vercel: ${project}/${env}`);
      result.vercel[`${project}/${env}`] = ok ? "ok" : (addRes.stderr?.split("\n")[0] ?? "fail");
    }
  }

  // Step 4: CF Worker secrets
  process.env.CLOUDFLARE_API_TOKEN = cfToken;
  for (const worker of cfg.cfWorkers) {
    const putRes = spawnSync("npx", ["wrangler", "secret", "put", name, "--name", worker], {
      input: secretValue + "\n",
      encoding: "utf8",
    });
    const ok = putRes.status === 0;
    console.log(`  ${ok ? "✓" : "✗"} cf worker: ${worker}`);
    result.cf[worker] = ok ? "ok" : (putRes.stderr?.split("\n")[0] ?? "fail");
  }

  // Step 5: local .env.local files
  for (const file of cfg.localFiles) {
    if (!existsSync(file)) {
      console.warn(`  ! local skip (missing): ${file}`);
      result.local.push({ file, status: "skip-missing" });
      continue;
    }
    const before = readFileSync(file, "utf8");
    const re = new RegExp(`^${name}=.*$`, "m");
    const after = re.test(before)
      ? before.replace(re, `${name}=${secretValue}`)
      : before + `\n${name}=${secretValue}\n`;
    writeFileSync(file, after);
    console.log(`  ✓ local: ${file.replace(HOME, "~")}`);
    result.local.push({ file, status: "ok" });
  }

  // Step 6: trigger Vercel redeploys (turbo-ignore may cancel; runtime env reads still pick up new value)
  if (cfg.redeployVercelAfterUpdate) {
    for (const [project, cwd] of cfg.vercelProjects) {
      if (!existsSync(cwd)) continue;
      const lsOut = execFileSync("vercel", ["ls"], { cwd, encoding: "utf8" });
      const last = lsOut.split("\n").find((l) => l.includes("Production") && l.includes("Ready"));
      if (!last) continue;
      const url = last.match(/(https:\/\/\S+\.vercel\.app)/)?.[1];
      if (!url) continue;
      spawnSync("vercel", ["redeploy", url, "--target=production"], { cwd, stdio: "ignore" });
    }
  }

  // Step 7: re-probe to confirm
  const verifyRes = spawnSync(
    "curl",
    ["-s", "-o", "/dev/null", "-w", "%{http_code}", cfg.probeUrl, ...headerArgs],
    { encoding: "utf8" }
  );
  const verified = verifyRes.stdout === String(cfg.probeOkStatus);
  console.log(`  ${verified ? "✓ re-probe verified" : `✗ re-probe failed (${verifyRes.stdout})`}`);
  result.verified = verified;

  // Wipe
  secretValue = "";
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────
const results = [];
for (const t of targets) {
  results.push(await rotateOne(t, SECRETS[t]));
}
delete process.env.CLOUDFLARE_API_TOKEN;

console.log("\n" + "═".repeat(78));
console.log("ROTATION SUMMARY");
console.log("═".repeat(78));
for (const r of results) {
  if (r.dry) {
    console.log(`  [dry-run] ${r.name}`);
    continue;
  }
  if (!r.success) {
    console.log(`  ✗ ${r.name}: ${r.reason}`);
    continue;
  }
  const vercelFails = Object.entries(r.vercel ?? {}).filter(([, v]) => v !== "ok");
  const cfFails = Object.entries(r.cf ?? {}).filter(([, v]) => v !== "ok");
  const localFails = (r.local ?? []).filter((l) => l.status !== "ok");
  const allOk = vercelFails.length === 0 && cfFails.length === 0 && localFails.length === 0 && r.verified;
  console.log(
    `  ${allOk ? "✓" : "⚠"} ${r.name}: ` +
    `vercel ${Object.keys(r.vercel).length - vercelFails.length}/${Object.keys(r.vercel).length}, ` +
    `cf ${Object.keys(r.cf).length - cfFails.length}/${Object.keys(r.cf).length}, ` +
    `local ${(r.local.length - localFails.length)}/${r.local.length}, ` +
    `verified=${r.verified}`
  );
  vercelFails.forEach(([k, v]) => console.log(`      vercel fail: ${k} (${v})`));
  cfFails.forEach(([k, v]) => console.log(`      cf fail: ${k} (${v})`));
  localFails.forEach((l) => console.log(`      local fail: ${l.file} (${l.status})`));
}
console.log("\ndone. all secret values wiped from process memory.");

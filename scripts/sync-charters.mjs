#!/usr/bin/env node
/**
 * sync-charters — bundle docs/agents/executive-charters.md into a build-time
 * TS module the port Worker can import.
 *
 * Why not read the .md at request time: Cloudflare Workers have no runtime
 * filesystem backing `nodejs_compat`'s `fs` polyfill (confirmed dead/unproven
 * in this deployment — see port/lib/shared/notion/fallback.ts, unused). The
 * existing precedent for "agent persona content in a Worker" is
 * port/lib/agent/agent-prompts.ts's CMO_POSTURE/PAM_POSTURE/CARL_POSTURE —
 * bundled string constants, historically hand-copy-pasted from
 * docs/{agent}/posture.md with no sync tooling (a real drift risk this
 * script closes for charters). Same pattern + direction as sync-tokens.mjs:
 * canonical source is the markdown Garrett edits; this script is the one
 * place that turns it into bundled code.
 *
 * Charters are governance-gated (docs/agents/executive-charters.md: "these
 * charters are edited by Garrett ONLY") — this script only ever reads that
 * file and regenerates the derived .ts; it never writes back to the .md.
 *
 *   node scripts/sync-charters.mjs            # write (regenerate charters.generated.ts)
 *   node scripts/sync-charters.mjs --check    # verify only; exit 1 if drifted
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "docs/agents/executive-charters.md");
const TARGET = join(ROOT, "port/lib/agent/charters.generated.ts");

// Display name (as it appears after "## ") → agent id. Matches the `agent`
// CHECK constraint used by agent_escalations/agent_interventions
// (opsy|biz|pam|mo|carl|fin).
const AGENT_KEYS = {
  Mo: "mo",
  PaM: "pam",
  Biz: "biz",
  cARL: "carl",
  Fin: "fin",
  Opsy: "opsy",
};

function parseCharters(md) {
  const lines = md.split("\n");

  // Preamble = everything from "**Governance rule:**" up to (not including)
  // the first standalone "---" line. Covers the governance rule + shared
  // rules bullets.
  const govIdx = lines.findIndex((l) => l.startsWith("**Governance rule:**"));
  const firstRuleIdx = lines.findIndex(
    (l, i) => i > govIdx && l.trim() === "---",
  );
  if (govIdx === -1 || firstRuleIdx === -1) {
    throw new Error(
      "could not find '**Governance rule:**' or the following '---' separator — charters.md structure changed, update the parser",
    );
  }
  const sharedRules = lines.slice(govIdx, firstRuleIdx).join("\n").trim();

  // Per-agent sections: "## <Name> — <title> *(phase)*" through the next
  // "## " heading or the closing "---" before the change log.
  const sections = {};
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) sections[current] = buf.join("\n").trim();
    buf = [];
  };
  for (let i = firstRuleIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^## (\S+)/);
    if (heading) {
      flush();
      const displayName = heading[1];
      const key = AGENT_KEYS[displayName];
      if (!key) {
        throw new Error(
          `unrecognized agent heading "${displayName}" in charters.md — add it to AGENT_KEYS in scripts/sync-charters.mjs`,
        );
      }
      current = key;
      buf.push(line);
      continue;
    }
    if (line.trim() === "---" && current) {
      flush();
      current = null;
      continue;
    }
    if (current) buf.push(line);
  }
  flush();

  const missing = Object.values(AGENT_KEYS).filter((k) => !sections[k]);
  if (missing.length) {
    throw new Error(`charters.md is missing sections for: ${missing.join(", ")}`);
  }

  return { sharedRules, sections };
}

function render({ sharedRules, sections }) {
  const versionLine =
    md.split("\n").find((l) => l.startsWith("# executive agent charters")) ??
    "# executive agent charters";

  const constDecls = Object.entries(sections)
    .map(([key, body]) => {
      const constName = `${key.toUpperCase()}_CHARTER`;
      return `export const ${constName} = ${JSON.stringify(body)};`;
    })
    .join("\n\n");

  const mapEntries = Object.keys(sections)
    .map((key) => `  ${key}: ${key.toUpperCase()}_CHARTER,`)
    .join("\n");

  return `// AUTO-SYNCED from docs/agents/executive-charters.md — DO NOT EDIT.
// Edit the charter (Garrett only — see the file's governance rule), then run:
//   npm run sync:charters
// Source: ${versionLine.trim()}

export const SHARED_CHARTER_RULES = ${JSON.stringify(sharedRules)};

${constDecls}

/** Full charter text per agent id, for prompt construction in ambient-run.ts. */
export const CHARTERS: Record<"mo" | "pam" | "biz" | "carl" | "fin" | "opsy", string> = {
${mapEntries}
};
`;
}

const check = process.argv.includes("--check");

let md;
try {
  md = readFileSync(SOURCE, "utf8");
} catch {
  console.error(`✗ charter source not found at ${SOURCE}`);
  process.exit(2);
}

const parsed = parseCharters(md);
const want = render(parsed);

const have = (() => {
  try {
    return readFileSync(TARGET, "utf8");
  } catch {
    return null;
  }
})();

const inSync = have === want;

if (check) {
  console.log(
    inSync
      ? "✓ charters.generated.ts is in sync with executive-charters.md"
      : "✗ DRIFT — charters.generated.ts is stale. Run: npm run sync:charters",
  );
  process.exit(inSync ? 0 : 1);
}

if (inSync) {
  console.log("· unchanged — charters.generated.ts already matches executive-charters.md");
} else {
  writeFileSync(TARGET, want);
  console.log(`✓ synced   port/lib/agent/charters.generated.ts  (${Object.keys(parsed.sections).length} agent charters + shared rules)`);
  console.log("  Remember: port is manual-deploy (npm run deploy:cf) — charter edits aren't live until redeployed.");
}

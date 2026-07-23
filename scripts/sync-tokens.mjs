#!/usr/bin/env node
/**
 * sync-tokens — single-source the design tokens across the twin repos.
 *
 * Canonical source of truth: `harbour-apps/packages/tokens` (the product repo,
 * which is always ahead — it carries the kid palette + harbour nav CSS). This
 * script copies canonical `index.css` + `index.ts` into windedvertigo's copies
 * so a brand/palette change is a ONE-place edit in harbour-apps + `npm run
 * sync:tokens` here, instead of hand-editing 4 drifted copies.
 *
 * Same pattern + direction as the harbour-nav widget sync (see CLAUDE.md).
 * Assumes the two repos are checked out as siblings (`~/Projects/{windedvertigo,
 * harbour-apps}`), which the nav sync already relies on.
 *
 * NOT a blind copy: each windedvertigo app layers a small, app-specific
 * override on top of the shared tokens — notably `--font-body`, which binds a
 * per-app `next/font` (port = Geist, site = Inter), and site's extended-footer
 * component CSS. Those live in the TAIL config below and are re-appended after
 * the canonical block on every sync, so they survive.
 *
 *   node scripts/sync-tokens.mjs            # write (back-port canonical → copies)
 *   node scripts/sync-tokens.mjs --check    # verify only; exit 1 if any drift
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANON = resolve(ROOT, "../harbour-apps/packages/tokens");

const CSS_HEADER =
  "/* ══════════════════════════════════════════════════════════════════\n" +
  "   AUTO-SYNCED from harbour-apps/packages/tokens/index.css — DO NOT EDIT.\n" +
  "   Edit the canonical file in harbour-apps, then run: npm run sync:tokens\n" +
  "   App-local overrides (if any) live in the marked block at the bottom.\n" +
  "   ══════════════════════════════════════════════════════════════════ */\n\n";

const TS_HEADER =
  "// AUTO-SYNCED from harbour-apps/packages/tokens/index.ts — DO NOT EDIT.\n" +
  "// Edit the canonical file in harbour-apps, then run: npm run sync:tokens\n\n";

const MARKER =
  "\n/* ══ app-local overrides (owned by sync-tokens.mjs, re-applied each sync) ══ */\n";

// Per-app CSS tails — the ONLY app-specific deltas (verified 07 jul 2026).
const FONT_PORT =
  ":root {\n  /* port loads Geist via next/font (--font-sans); keep it over canonical Inter */\n" +
  "  --font-body: var(--font-sans, 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif);\n}\n";

const FONT_SITE =
  ":root {\n  /* site loads Inter via next/font (--font-inter); keep the optimized binding */\n" +
  "  --font-body: var(--font-inter), 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;\n}\n";

const SITE_FOOTER =
  "\n/* site-only extended-footer component CSS (not in the shared WV_FOOTER_HTML) */\n" +
  ".wv-footer-right {\n  display: flex;\n  align-items: center;\n  gap: var(--space-xl);\n}\n\n" +
  ".wv-footer-subscribe {\n  font-size: 0.85rem;\n  font-weight: 500;\n  color: var(--wv-white);\n" +
  "  text-decoration: none;\n  text-transform: lowercase;\n  transition: color 0.2s ease;\n  white-space: nowrap;\n}\n\n" +
  ".wv-footer-subscribe:hover {\n  color: var(--wv-champagne);\n}\n\n" +
  "@media (max-width: 640px) {\n  .wv-footer-right {\n    flex-direction: column;\n    gap: var(--space-md);\n  }\n}\n";

// Destinations. `ts: null` = CSS-only consumer (site). `tail` = app-local CSS.
const TARGETS = [
  { name: "packages/tokens (workspace pkg → ops)", css: "packages/tokens/index.css", ts: "packages/tokens/index.ts", tail: "" },
  { name: "port local copy", css: "port/lib/shared/tokens/index.css", ts: "port/lib/shared/tokens/index.ts", tail: FONT_PORT },
  { name: "site local copy", css: "site/styles/tokens.css", ts: null, tail: FONT_SITE + SITE_FOOTER },
  // Legacy standalone served at /styles/tokens.css — unreferenced by the live CF
  // Worker (bundle @import is the styling path), kept in sync for honesty until
  // confirmed dead + deleted. Same site tail.
  { name: "site public copy (legacy /styles/tokens.css)", css: "site/public/styles/tokens.css", ts: null, tail: FONT_SITE + SITE_FOOTER },
];

function readCanon() {
  let css, ts;
  try {
    css = readFileSync(join(CANON, "index.css"), "utf8");
    ts = readFileSync(join(CANON, "index.ts"), "utf8");
  } catch {
    console.error(
      `✗ canonical tokens not found at ${CANON}\n` +
        `  This sync needs harbour-apps checked out beside windedvertigo (~/Projects/{windedvertigo,harbour-apps}).`,
    );
    process.exit(2);
  }
  return { css, ts };
}

function expectedCss(canonCss, tail) {
  return CSS_HEADER + canonCss.replace(/\s*$/, "\n") + (tail ? MARKER + tail : "");
}
function expectedTs(canonTs) {
  return TS_HEADER + canonTs.replace(/\s*$/, "\n");
}

const check = process.argv.includes("--check");
const { css: canonCss, ts: canonTs } = readCanon();

let drift = 0;
for (const t of TARGETS) {
  const jobs = [
    { path: t.css, want: expectedCss(canonCss, t.tail) },
    ...(t.ts ? [{ path: t.ts, want: expectedTs(canonTs) }] : []),
  ];
  for (const j of jobs) {
    const abs = join(ROOT, j.path);
    const have = (() => {
      try {
        return readFileSync(abs, "utf8");
      } catch {
        return null;
      }
    })();
    const inSync = have === j.want;
    if (check) {
      if (!inSync) {
        drift++;
        console.log(`  ✗ DRIFT  ${j.path}`);
      } else {
        console.log(`  ✓ in sync ${j.path}`);
      }
    } else {
      if (inSync) {
        console.log(`  · unchanged ${j.path}`);
      } else {
        writeFileSync(abs, j.want);
        console.log(`  ✓ synced   ${j.path}  (${t.name})`);
      }
    }
  }
}

if (check) {
  console.log(drift ? `\n✗ ${drift} file(s) drifted — run: npm run sync:tokens` : "\n✓ all token copies in sync with harbour-apps canonical");
  process.exit(drift ? 1 : 0);
}
console.log("\n✓ sync complete. Remember: site + port are manual-deploy (npm run deploy:cf).");

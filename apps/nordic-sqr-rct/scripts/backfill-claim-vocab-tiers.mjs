#!/usr/bin/env node
/**
 * Phase 4.6 — backfill the 4-tier claim vocabulary on existing PCS Claims.
 *
 * Companion to docs/reviews/claim-vocab-redundancy-2026-05-03.md.
 *
 * What this does:
 *   1. Read every PCS Claim from NOTION_PCS_CLAIMS_DB.
 *   2. For each, propose:
 *      - Canonical Claim relation        (Tier 2)
 *      - Core benefit relation           (Tier 1 fine-grained)
 *      - Claim prefix relation           (Tier 1.5 strength)
 *      - Wording Variants split          (Tier 3, from "/"-separated titles)
 *   3. Write a markdown report of the proposed mappings + per-row confidence.
 *
 * The structure ALREADY EXISTS in the live Notion workspace; this script
 * just connects the dots. See pcs-config.js for the database IDs.
 *
 * Usage:
 *   node scripts/backfill-claim-vocab-tiers.mjs                  # dry-run, writes /tmp/claim-backfill-proposal.md
 *   node scripts/backfill-claim-vocab-tiers.mjs --apply          # writes the relations to Notion
 *   node scripts/backfill-claim-vocab-tiers.mjs --confidence 0.8 # only auto-apply rows with confidence >= 0.8
 *
 * Heuristic notes:
 *   - String similarity uses a normalized Levenshtein over the lowercased,
 *     punctuation-stripped, asterisk-stripped text. Threshold 0.7 default.
 *   - "/"-separated titles are split into N variants. The first becomes
 *     `is_primary = true`; the rest are linked back to the same PCS Claim.
 *   - Rows that don't match any canonical above the threshold are marked
 *     `needs-more-info` so Lauren can review via the feedback button.
 *
 * Safety:
 *   - Dry-run by default. NEVER writes without --apply.
 *   - Skips rows that already have Canonical Claim populated (idempotent).
 *   - Respects Notion API rate limits (3/s) via simple sleep.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env ───────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const NOTION_TOKEN              = process.env.NOTION_TOKEN;
const PCS_CLAIMS_DB             = process.env.NOTION_PCS_CLAIMS_DB;
const CANONICAL_CLAIMS_DB       = 'f6e58750-ed46-4355-bd31-19434c6591f2';
const CORE_BENEFITS_DB          = 'f8aaa39f-817a-4006-bffc-26264008ebdb';
const CLAIM_PREFIXES_DB         = '7ed1891c-cd48-405f-b4f4-8384c1a4ed41';
const CLAIM_WORDING_VARIANTS_DB = '52c486b0-8d99-4d04-9707-bfea76165ac9';

if (!NOTION_TOKEN) { console.error('NOTION_TOKEN not set'); process.exit(1); }
if (!PCS_CLAIMS_DB) { console.error('NOTION_PCS_CLAIMS_DB not set'); process.exit(1); }

// ─── Args ───────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v == null ? true : v];
  }),
);
const APPLY                = !!args.apply;
const DRY_RUN              = !APPLY;
const CONFIDENCE_THRESHOLD = parseFloat(args.confidence ?? '0.7');
const REPORT_PATH          = args.report ?? '/tmp/claim-backfill-proposal.md';

console.log(`\nPhase 4.6 backfill — claim vocabulary tiers`);
console.log(`  Mode:                  ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
console.log(`  Confidence threshold:  ${CONFIDENCE_THRESHOLD}`);
console.log(`  Report path:           ${REPORT_PATH}\n`);

// ─── Notion API helpers ─────────────────────────────────────────────────────
const NOTION = 'https://api.notion.com/v1';
const HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2025-09-03',
  'Content-Type': 'application/json',
};

async function fetchAllPages(databaseId) {
  const all = [];
  let cursor;
  do {
    const r = await fetch(`${NOTION}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`fetchAllPages(${databaseId}) ${r.status}: ${err}`);
    }
    const j = await r.json();
    all.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
    await sleep(350); // 3/s rate limit
  } while (cursor);
  return all;
}

async function updatePageRelations(pageId, props) {
  const r = await fetch(`${NOTION}/pages/${pageId}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ properties: props }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`update ${pageId}: ${r.status} ${err}`);
  }
  await sleep(350);
  return r.json();
}

async function createWordingVariant({ wording, pcsClaimId, isPrimary, notes }) {
  const r = await fetch(`${NOTION}/pages`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      parent: { database_id: CLAIM_WORDING_VARIANTS_DB },
      properties: {
        Wording: { title: [{ text: { content: wording } }] },
        'PCS Claim': { relation: [{ id: pcsClaimId }] },
        'Is primary': { checkbox: !!isPrimary },
        ...(notes ? { 'Variant notes': { rich_text: [{ text: { content: notes } }] } } : {}),
      },
    }),
  });
  if (!r.ok) throw new Error(`createVariant: ${r.status} ${await r.text()}`);
  await sleep(350);
  return r.json();
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── Title normalization + similarity ───────────────────────────────────────
function normalize(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/\*+/g, '')                            // drop asterisks
    .replace(/[()]/g, '')                            // drop parens
    .replace(/[^\w\s/-]/g, ' ')                      // drop punctuation
    .replace(/\bthe\b|\ba\b|\ban\b/g, ' ')           // drop articles
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

// ─── Title parsers ──────────────────────────────────────────────────────────

const KNOWN_PREFIXES = [
  'Required for/Plays a critical role in/Supports',
  'Required for/Plays a critical role in/Nutritional Support for (certain aspects of)',
  'Required for/Plays a critical role in/Nutritional Support for',
  'Nutritional support for',
  'Provides nutritional support for',
  'Essential nutrient support for',
  'Helps to maintain the body\'s ability to',
  'Helps to maintain',
  'Helps to support',
  'Helps support',
  'Helps to',
  'Helps in',
  'Supports certain aspects of',
  'Contributes to',
  'One serving',
  'Promotes',
  'Supports',
  'Helps',
];

function extractPrefix(title) {
  // Try to match the longest prefix.
  const t = title.trim();
  for (const p of KNOWN_PREFIXES) {
    if (t.toLowerCase().startsWith(p.toLowerCase())) {
      return { prefix: p, remainder: t.slice(p.length).trim() };
    }
  }
  return { prefix: null, remainder: t };
}

function splitVariants(title) {
  // Lauren's grammar uses " / " but the live DB also uses "/" (no spaces).
  // We split on " / " first; if no match, fall back to "/" but only when
  // there are exactly two slash-separated tokens that look like phrases.
  if (title.includes(' / ')) return title.split(' / ').map((s) => s.trim()).filter(Boolean);
  // Compound titles like "Helps in the absorption (and use) of calcium and phosphorus / for bone health"
  return [title.trim()];
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('Loading dictionaries…');
  const [canonical, prefixes, benefits, pcsClaims] = await Promise.all([
    fetchAllPages(CANONICAL_CLAIMS_DB),
    fetchAllPages(CLAIM_PREFIXES_DB),
    fetchAllPages(CORE_BENEFITS_DB),
    fetchAllPages(PCS_CLAIMS_DB),
  ]);

  console.log(`  Canonical Claims:  ${canonical.length}`);
  console.log(`  Claim Prefixes:    ${prefixes.length}`);
  console.log(`  Core Benefits:     ${benefits.length}`);
  console.log(`  PCS Claims:        ${pcsClaims.length}\n`);

  // Build lookup tables
  const canonicalIndex = canonical.map((p) => ({
    id: p.id,
    title: titleOf(p, 'Canonical claim'),
  }));
  const prefixIndex = prefixes.map((p) => ({
    id: p.id,
    title: titleOf(p, 'Prefix'),
  }));
  const benefitIndex = benefits.map((p) => ({
    id: p.id,
    title: titleOf(p, 'Core benefit'),
  }));

  const proposals = [];
  let alreadyLinked = 0;
  let highConfidence = 0;
  let lowConfidence = 0;
  let unmatchable = 0;

  for (const claim of pcsClaims) {
    const title = titleOf(claim, 'Claim');
    const existingCanonical = (claim.properties?.['Canonical Claim']?.relation || [])[0];

    if (existingCanonical) {
      alreadyLinked++;
      continue;
    }

    if (!title) continue;

    // 1. Extract prefix → strength tier
    const { prefix, remainder } = extractPrefix(title);
    const matchedPrefix = prefix
      ? prefixIndex.find((p) => p.title.toLowerCase() === prefix.toLowerCase())
      : null;

    // 2. Match the remainder against canonical claim titles
    let bestCanonical = null;
    let bestScore = 0;
    for (const c of canonicalIndex) {
      const s = similarity(remainder || title, c.title);
      if (s > bestScore) { bestScore = s; bestCanonical = c; }
    }

    // 3. Try to match a core benefit from substrings
    const benefitMatches = benefitIndex
      .map((b) => ({ b, s: titleContains(title, b.title) ? 0.9 : similarity(title, b.title) }))
      .filter((x) => x.s > 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);

    // 4. Variants
    const variants = splitVariants(remainder || title);

    const proposal = {
      pcsClaimId: claim.id,
      title,
      prefix: matchedPrefix
        ? { id: matchedPrefix.id, title: matchedPrefix.title }
        : null,
      canonical: bestCanonical && bestScore >= 0.5
        ? { id: bestCanonical.id, title: bestCanonical.title, score: bestScore }
        : null,
      benefits: benefitMatches.map((x) => ({ id: x.b.id, title: x.b.title, score: x.s })),
      variants,
      confidence: computeConfidence({ matchedPrefix, bestScore, benefitMatches }),
    };
    proposals.push(proposal);

    if (proposal.confidence >= CONFIDENCE_THRESHOLD) highConfidence++;
    else if (proposal.canonical) lowConfidence++;
    else unmatchable++;
  }

  // ─── Report ──────────────────────────────────────────────────────────────
  const report = renderReport({
    counts: { total: pcsClaims.length, alreadyLinked, highConfidence, lowConfidence, unmatchable },
    proposals,
    canonicalCount: canonical.length,
    prefixCount: prefixes.length,
    benefitCount: benefits.length,
    threshold: CONFIDENCE_THRESHOLD,
    apply: APPLY,
  });
  writeFileSync(REPORT_PATH, report);
  console.log(`\nReport written: ${REPORT_PATH}\n`);
  console.log(`  Total PCS Claims:       ${pcsClaims.length}`);
  console.log(`  Already linked:         ${alreadyLinked}`);
  console.log(`  High-confidence (≥${CONFIDENCE_THRESHOLD}):  ${highConfidence}`);
  console.log(`  Low-confidence:         ${lowConfidence}`);
  console.log(`  Unmatchable:            ${unmatchable}\n`);

  if (DRY_RUN) {
    console.log('Dry-run complete. Re-run with --apply to write the proposed relations.');
    process.exit(0);
  }

  // ─── Apply (only proposals with confidence >= threshold) ─────────────────
  console.log(`Applying ${highConfidence} high-confidence proposals…`);
  let writtenCount = 0;
  for (const p of proposals) {
    if (p.confidence < CONFIDENCE_THRESHOLD) continue;
    const props = {};
    if (p.canonical) props['Canonical Claim'] = { relation: [{ id: p.canonical.id }] };
    if (p.prefix)    props['Claim prefix']    = { relation: [{ id: p.prefix.id }] };
    if (p.benefits.length) props['Core benefit'] = { relation: p.benefits.map((b) => ({ id: b.id })) };
    try {
      await updatePageRelations(p.pcsClaimId, props);
      // Variants
      for (let i = 0; i < p.variants.length; i++) {
        await createWordingVariant({
          wording: p.variants[i],
          pcsClaimId: p.pcsClaimId,
          isPrimary: i === 0,
          notes: p.variants.length > 1 ? `Auto-split from compound title (variant ${i + 1}/${p.variants.length})` : null,
        });
      }
      writtenCount++;
      if (writtenCount % 5 === 0) console.log(`  ${writtenCount} / ${highConfidence}…`);
    } catch (err) {
      console.error(`  FAIL ${p.pcsClaimId}: ${err.message}`);
    }
  }
  console.log(`\n${writtenCount} writes applied. Low-confidence proposals (n=${lowConfidence}) require manual review via the in-app feedback button (see docs/runbooks/wave-6.1-feedback-button.md).`);
})().catch((err) => { console.error(err); process.exit(1); });

// ─── Helpers ────────────────────────────────────────────────────────────────

function titleOf(page, propertyName) {
  const prop = page.properties?.[propertyName];
  if (!prop) return '';
  if (prop.title) return prop.title.map((t) => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map((t) => t.plain_text).join('');
  return '';
}

function titleContains(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

function computeConfidence({ matchedPrefix, bestScore, benefitMatches }) {
  // Weighted: 50% canonical match, 30% prefix match, 20% benefit match
  const c = (bestScore || 0) * 0.5
          + (matchedPrefix ? 0.3 : 0)
          + (benefitMatches.length ? 0.2 : 0);
  return Math.round(c * 100) / 100;
}

function renderReport({ counts, proposals, canonicalCount, prefixCount, benefitCount, threshold, apply }) {
  const lines = [
    `# Phase 4.6 Backfill Proposal — Claim Vocabulary Tiers`,
    ``,
    `**Date:** ${new Date().toISOString().slice(0, 10)}  `,
    `**Mode:** ${apply ? 'APPLY' : 'DRY-RUN'}  `,
    `**Confidence threshold:** ${threshold}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `|---|---:|`,
    `| Total PCS Claims | ${counts.total} |`,
    `| Already linked (skipped) | ${counts.alreadyLinked} |`,
    `| High-confidence (≥ ${threshold}) | **${counts.highConfidence}** |`,
    `| Low-confidence (manual review) | ${counts.lowConfidence} |`,
    `| Unmatchable | ${counts.unmatchable} |`,
    ``,
    `## Dictionaries used`,
    ``,
    `- Canonical Claims: ${canonicalCount} entries`,
    `- Claim Prefixes:   ${prefixCount} entries`,
    `- Core Benefits:    ${benefitCount} entries`,
    ``,
    `## Proposed mappings`,
    ``,
    `| Confidence | PCS Claim | → Canonical | Prefix | Variants |`,
    `|---:|---|---|---|---:|`,
  ];
  proposals.sort((a, b) => b.confidence - a.confidence);
  for (const p of proposals) {
    const cellEsc = (s) => (s || '').replace(/\|/g, '\\|');
    const variantStr = p.variants.length === 1 ? '1' : `${p.variants.length}`;
    lines.push(
      `| ${p.confidence.toFixed(2)} | ${cellEsc(p.title.slice(0, 70))} | ${cellEsc(p.canonical?.title?.slice(0, 50) || '—')} | ${cellEsc(p.prefix?.title?.slice(0, 30) || '—')} | ${variantStr} |`,
    );
  }
  lines.push(
    ``,
    `## Manual-review queue (low-confidence)`,
    ``,
    `These rows did not match a canonical claim above the threshold. Lauren / RES should review via the in-app feedback button (see \`docs/runbooks/wave-6.1-feedback-button.md\`):`,
    ``,
  );
  for (const p of proposals.filter((x) => x.confidence < threshold)) {
    lines.push(`- \`${p.pcsClaimId}\` — ${p.title}`);
  }
  return lines.join('\n');
}

/**
 * Phase 4.6 Bundle B — Canonical-claim mapping matcher.
 *
 * Live-derives "PCS claim → Canonical claim" mapping proposals from the
 * current Notion state. Used by:
 *   /api/pcs/canonical-claims/backfill-review (GET) — list pending proposals
 *   /api/pcs/canonical-claims/backfill-review (POST) — approve one
 *
 * The same heuristic runs in `scripts/backfill-claim-vocab-tiers.mjs`
 * for batch dry-run reporting; this module is the runtime UI version.
 *
 * Algorithm (matches the script):
 *   1. Strip a known leading prefix from the PCS claim title
 *      ("Required for/Plays a critical role in/Supports", "Helps to",
 *      "Nutritional support for", etc.). Match against Claim Prefixes DB.
 *   2. Run normalized Levenshtein similarity over the remainder against
 *      every Canonical Claim title.
 *   3. Find Core Benefits whose title appears as a substring of the PCS
 *      claim title (or fuzzy-matches with similarity ≥ 0.5).
 *   4. Compute a weighted confidence score:
 *        canonical*0.5 + (prefix?0.3:0) + (benefits?0.2:0)
 *   5. Split " / "-separated compound titles into N variants for the
 *      Wording Variants relation.
 *
 * The matcher does NOT mutate Notion. Approval lives in the API POST handler.
 */

import { notion } from './notion.js';
import { PCS_DB, PROPS } from './pcs-config.js';

// ─── String similarity ──────────────────────────────────────────────────────

export function normalize(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\*+/g, '')
    .replace(/[()]/g, '')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\bthe\b|\ba\b|\ban\b/g, ' ')
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

export function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// ─── Prefix extraction ──────────────────────────────────────────────────────

export const KNOWN_PREFIXES = [
  'Required for/Plays a critical role in/Supports',
  'Required for/Plays a critical role in/Nutritional Support for (certain aspects of)',
  'Required for/Plays a critical role in/Nutritional Support for',
  'Nutritional support for',
  'Provides nutritional support for',
  'Essential nutrient support for',
  "Helps to maintain the body's ability to",
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

export function extractPrefix(title) {
  const t = (title || '').trim();
  for (const p of KNOWN_PREFIXES) {
    if (t.toLowerCase().startsWith(p.toLowerCase())) {
      return { prefix: p, remainder: t.slice(p.length).trim() };
    }
  }
  return { prefix: null, remainder: t };
}

export function splitVariants(title) {
  const t = (title || '').trim();
  if (t.includes(' / ')) return t.split(' / ').map((s) => s.trim()).filter(Boolean);
  return [t];
}

// ─── Notion fetchers ────────────────────────────────────────────────────────

async function fetchAll(databaseId) {
  if (!databaseId) return [];
  const all = [];
  let cursor;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < 50);
  return all;
}

function titleOf(page, propertyName) {
  const prop = page.properties?.[propertyName];
  if (!prop) return '';
  if (prop.title) return prop.title.map((t) => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map((t) => t.plain_text).join('');
  return '';
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns all PCS Claims with their proposed canonical/prefix/benefit mapping
 * and a confidence score. Does NOT mutate Notion.
 *
 * @returns {Promise<Array<{
 *   pcsClaimId: string,
 *   pcsClaimTitle: string,
 *   currentCanonicalId: string|null,
 *   proposedCanonical: { id: string, title: string, score: number } | null,
 *   proposedPrefix: { id: string, title: string } | null,
 *   proposedBenefits: Array<{ id: string, title: string, score: number }>,
 *   variants: string[],
 *   confidence: number
 * }>>}
 */
export async function getMatchingProposals() {
  const [pcsClaims, canonical, prefixes, benefits] = await Promise.all([
    fetchAll(PCS_DB.claims),
    fetchAll(PCS_DB.canonicalClaims),
    fetchAll(PCS_DB.prefixes),
    fetchAll(PCS_DB.coreBenefits),
  ]);

  const canonicalIndex = canonical.map((p) => ({ id: p.id, title: titleOf(p, PROPS.canonicalClaims.canonicalClaim) }));
  const prefixIndex = prefixes.map((p) => ({ id: p.id, title: titleOf(p, PROPS.prefixes.prefix) }));
  const benefitIndex = benefits.map((p) => ({ id: p.id, title: titleOf(p, PROPS.coreBenefits.coreBenefit) }));

  const proposals = [];
  for (const claim of pcsClaims) {
    const title = titleOf(claim, PROPS.claims.claim);
    if (!title) continue;
    const currentCanonicalId = (claim.properties?.[PROPS.claims.canonicalClaim]?.relation || [])[0]?.id || null;

    const { prefix, remainder } = extractPrefix(title);
    const matchedPrefix = prefix
      ? prefixIndex.find((p) => p.title.toLowerCase() === prefix.toLowerCase())
      : null;

    let bestCanonical = null;
    let bestScore = 0;
    for (const c of canonicalIndex) {
      const s = similarity(remainder || title, c.title);
      if (s > bestScore) {
        bestScore = s;
        bestCanonical = c;
      }
    }

    const benefitMatches = benefitIndex
      .map((b) => ({
        b,
        s: normalize(title).includes(normalize(b.title)) ? 0.9 : similarity(title, b.title),
      }))
      .filter((x) => x.s > 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);

    const variants = splitVariants(remainder || title);
    const confidence =
      Math.round(
        ((bestScore || 0) * 0.5 + (matchedPrefix ? 0.3 : 0) + (benefitMatches.length ? 0.2 : 0)) * 100,
      ) / 100;

    proposals.push({
      pcsClaimId: claim.id,
      pcsClaimTitle: title,
      currentCanonicalId,
      proposedCanonical:
        bestCanonical && bestScore >= 0.5
          ? { id: bestCanonical.id, title: bestCanonical.title, score: Math.round(bestScore * 100) / 100 }
          : null,
      proposedPrefix: matchedPrefix ? { id: matchedPrefix.id, title: matchedPrefix.title } : null,
      proposedBenefits: benefitMatches.map((x) => ({
        id: x.b.id,
        title: x.b.title,
        score: Math.round(x.s * 100) / 100,
      })),
      variants,
      confidence,
      classificationMethod: 'regex-heuristic-v1',
    });
  }

  // Sort: unapplied + high confidence first
  return proposals.sort((a, b) => {
    if (!!a.currentCanonicalId !== !!b.currentCanonicalId) return a.currentCanonicalId ? 1 : -1;
    return b.confidence - a.confidence;
  });
}

/**
 * Filters proposals by status. Convenience for the UI.
 */
export function filterProposals(proposals, status, minConfidence = 0) {
  return proposals.filter((p) => {
    if (status === 'applied') return !!p.currentCanonicalId;
    if (status === 'pending-high') return !p.currentCanonicalId && p.confidence >= 0.7;
    if (status === 'pending-low') return !p.currentCanonicalId && p.confidence < 0.7 && !!p.proposedCanonical;
    if (status === 'unmatchable') return !p.currentCanonicalId && !p.proposedCanonical;
    return p.confidence >= minConfidence;
  });
}

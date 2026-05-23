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

// Part 10 (2026-05-23): switched from raw Notion queries to Postgres-first
// lib readers. Each of these libs has shouldReadFromPostgres() guards and
// returns parsed shape with camelCase fields — no more page.properties[X]
// title extraction needed.
import { getAllClaims } from './pcs-claims.js';
import { getAllCanonicalClaims } from './pcs-canonical-claims.js';
import { getAllPrefixes } from './pcs-prefixes.js';
import { getAllCoreBenefits } from './pcs-core-benefits.js';
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

// ─── Data fetchers — Postgres-first via lib helpers ─────────────────────────
//
// The lib helpers already handle PCS_READ_FROM_POSTGRES. Each returns parsed
// shape (camelCase fields, no Notion `page.properties` layer), so the matcher
// no longer needs its own `titleOf` extractor.

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
    getAllClaims(),
    getAllCanonicalClaims(),
    getAllPrefixes(),
    getAllCoreBenefits(),
  ]);

  // Parsed shapes from the Postgres-first libs — fields are already camelCase.
  const canonicalIndex = canonical.map((c) => ({ id: c.id, title: c.canonicalClaim || '' }));
  const prefixIndex    = prefixes.map((p)  => ({ id: p.id, title: p.prefix || '' }));
  const benefitIndex   = benefits.map((b)  => ({ id: b.id, title: b.coreBenefit || '' }));

  // Pre-normalize the canonical and benefit titles once — reused across all
  // claim iterations rather than re-computed inside the inner loops.
  const canonicalIndexNorm = canonicalIndex.map((c) => ({ ...c, norm: normalize(c.title) }));
  const benefitIndexNorm = benefitIndex.map((b) => ({ ...b, norm: normalize(b.title) }));

  const proposals = [];
  for (const claim of pcsClaims) {
    const title = claim.claim || '';
    if (!title) continue;
    const currentCanonicalId = claim.canonicalClaimId || null;

    // ── Fast path: claim is already mapped ──────────────────────────────────
    // Skip the expensive Levenshtein + benefit loops entirely. The proposal is
    // recorded for stats/display but no new matching is needed.
    if (currentCanonicalId) {
      proposals.push({
        pcsClaimId: claim.id,
        pcsClaimTitle: title,
        currentCanonicalId,
        proposedCanonical: null,
        proposedPrefix: null,
        proposedBenefits: [],
        variants: splitVariants(title),
        confidence: 1,
        classificationMethod: 'already-applied',
      });
      continue;
    }

    // ── Slow path: unmatched claim — run full heuristic ──────────────────────
    const { prefix, remainder } = extractPrefix(title);
    const matchedPrefix = prefix
      ? prefixIndex.find((p) => p.title.toLowerCase() === prefix.toLowerCase())
      : null;

    // Pre-normalize the search target once for this claim.
    const searchTarget = remainder || title;
    const searchTargetNorm = normalize(searchTarget);

    let bestCanonical = null;
    let bestScore = 0;
    for (const c of canonicalIndexNorm) {
      const s = 1 - levenshtein(searchTargetNorm, c.norm) / Math.max(searchTargetNorm.length, c.norm.length, 1);
      if (s > bestScore) {
        bestScore = s;
        bestCanonical = c;
        // Short-circuit: near-perfect match — no need to scan the rest.
        if (bestScore >= 0.95) break;
      }
    }

    // Benefit matching: substring check first (O(1) per benefit); only run
    // Levenshtein on benefits that don't substring-match.
    const normalizedTitle = normalize(title);
    const benefitMatches = benefitIndexNorm
      .map((b) => ({
        b,
        s: normalizedTitle.includes(b.norm)
          ? 0.9
          : b.norm.length > 3 && normalizedTitle.length > 3
            ? similarity(normalizedTitle, b.norm)
            : 0,
      }))
      .filter((x) => x.s > 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);

    const variants = splitVariants(searchTarget);
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

/**
 * LLM-assisted backfill for PCS Claim → Claim Prefix + Core Benefit relations.
 *
 * Multi-profile architecture (Week 2) — added 2026-04-19.
 *
 * Shared between:
 *   - CLI:  scripts/backfill-claim-prefixes.mjs
 *   - API:  src/app/api/admin/backfill/claim-prefixes/route.js
 *
 * For each PCS Claim that lacks claimPrefixId or coreBenefitId we:
 *   1. Ask Claude to extract { prefix, coreBenefit, benefitCategory } from
 *      the raw claim text (single short call, temperature 0).
 *   2. Resolve the prefix against the seeded Claim Prefixes vocabulary
 *      (case-insensitive trim).
 *   3. Resolve/lazily-create the core benefit via resolveOrCreate(),
 *      attaching the resolved benefit category if we matched one.
 *   4. Update the claim with { claimPrefixId, coreBenefitId } unless
 *      dryRun is true.
 *
 * The pipeline is best-effort: a single claim failure is logged and the
 * batch continues.
 */

import { getAllClaims, updateClaim } from './pcs-claims.js';
import { resolvePrefix, getAllPrefixes } from './pcs-prefixes.js';
import { resolveByName as resolveBenefitCategory, getAllBenefitCategories } from './pcs-benefit-categories.js';
import { resolveOrCreate as resolveOrCreateCoreBenefit } from './pcs-core-benefits.js';

const NOTION_WRITE_DELAY_MS = 350;

/**
 * Build the extraction prompt dynamically from the LIVE vocabularies in
 * Notion. The hand-seeded hard-coded lists were wrong (see CAIPB import);
 * fetching at runtime ensures the LLM always targets the real 18 prefixes
 * and 7 benefit categories.
 */
function buildPrompt(claimText, prefixVocab, benefitCategoryVocab) {
  return `You are a regulatory taxonomy extractor for Nordic Naturals PCS claims.

Given a claim text, extract three fields:
- prefix: one of ${JSON.stringify(prefixVocab)} that appears at the start. Prefixes may be compound equivalence classes (slash-separated); match the full class string verbatim. Return null if no class fits.
- coreBenefit: the prefix-stripped body of the claim, lowercase, trimmed (e.g. "supports normal mood" -> "normal mood"). No trailing punctuation or asterisks.
- benefitCategory: one of ${JSON.stringify(benefitCategoryVocab)} that best describes the claim. Return null if unclear.

Respond with a JSON object: {"prefix":..., "coreBenefit":..., "benefitCategory":...}
No commentary.

Claim: ${JSON.stringify(claimText)}`;
}

function parseJsonResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch { /* fall through */ }
  }
  return null;
}

/**
 * Call Claude once to extract prefix / coreBenefit / benefitCategory.
 *
 * @param {string} claimText
 * @returns {Promise<{prefix:string|null, coreBenefit:string|null, benefitCategory:string|null}>}
 */
export async function extractClaimTaxonomy(claimText, { prefixVocab, benefitCategoryVocab } = {}) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is not configured');
  const model = process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929';

  // Fall back to fetching if vocabs weren't passed in (single-shot API callers).
  let pVocab = prefixVocab;
  let cVocab = benefitCategoryVocab;
  if (!pVocab) {
    const prefixes = await getAllPrefixes();
    pVocab = prefixes.map(p => p.prefix).filter(Boolean);
  }
  if (!cVocab) {
    const cats = await getAllBenefitCategories();
    cVocab = cats.map(c => c.name).filter(Boolean);
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: 300,
    temperature: 0,
    messages: [
      { role: 'user', content: buildPrompt(claimText, pVocab, cVocab) },
    ],
  });

  const text = message?.content?.[0]?.text || '';
  const parsed = parseJsonResponse(text);
  if (!parsed) {
    throw new Error(`Could not parse LLM response: ${text.slice(0, 200)}`);
  }
  return {
    prefix: typeof parsed.prefix === 'string' ? parsed.prefix : null,
    coreBenefit: typeof parsed.coreBenefit === 'string' ? parsed.coreBenefit : null,
    benefitCategory: typeof parsed.benefitCategory === 'string' ? parsed.benefitCategory : null,
  };
}

/**
 * Resolve a benefit category name (case-insensitive) using a pre-fetched cache.
 */
function resolveBenefitCategoryFromCache(name, cache) {
  if (!name || typeof name !== 'string') return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;
  return cache.find(c => c.name.trim().toLowerCase() === target) || null;
}

/**
 * Run the backfill pipeline.
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]      — if true, no Notion writes
 * @param {number}  [opts.limit]             — cap claims processed
 * @param {(line:string)=>void} [opts.log]   — per-claim audit logger (default: noop)
 * @returns {Promise<object>} results struct
 */
export async function runClaimPrefixBackfill({ dryRun = false, limit, log = () => {} } = {}) {
  const results = {
    summary: {
      totalClaims: 0,
      candidates: 0,
      processed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      dryRun,
    },
    updated: [],
    skipped: [],
    failed: [],
  };

  // Pre-fetch vocabularies once — benefit categories, claim prefixes —
  // so the LLM gets the current live taxonomy and we can resolve by name
  // without re-fetching per claim.
  const benefitCategoryCache = await getAllBenefitCategories();
  const prefixCache = await getAllPrefixes();
  const prefixVocab = prefixCache.map(p => p.prefix).filter(Boolean);
  const benefitCategoryVocab = benefitCategoryCache.map(c => c.name).filter(Boolean);

  const allClaims = await getAllClaims();
  results.summary.totalClaims = allClaims.length;

  const candidates = allClaims.filter(c => !c.claimPrefixId || !c.coreBenefitId);
  results.summary.candidates = candidates.length;

  const batch = typeof limit === 'number' ? candidates.slice(0, limit) : candidates;

  for (const claim of batch) {
    results.summary.processed++;
    const audit = {
      id: claim.id,
      claimNo: claim.claimNo || null,
      claim: claim.claim,
    };

    if (!claim.claim || !claim.claim.trim()) {
      results.skipped.push({ ...audit, reason: 'empty claim text' });
      results.summary.skipped++;
      log(`[skip] ${claim.claimNo || claim.id}: empty claim text`);
      continue;
    }

    let extraction;
    try {
      extraction = await extractClaimTaxonomy(claim.claim, { prefixVocab, benefitCategoryVocab });
    } catch (err) {
      results.failed.push({ ...audit, reason: `LLM error: ${err.message}` });
      results.summary.failed++;
      log(`[fail] ${claim.claimNo || claim.id}: LLM error — ${err.message}`);
      continue;
    }

    let claimPrefixId = claim.claimPrefixId || null;
    let coreBenefitId = claim.coreBenefitId || null;
    let prefixText = null;
    let coreBenefitText = null;
    let benefitCategoryName = null;

    try {
      if (!claimPrefixId && extraction.prefix) {
        const row = await resolvePrefix(extraction.prefix);
        if (row) {
          claimPrefixId = row.id;
          prefixText = row.prefix;
        }
      }
    } catch (err) {
      log(`[warn] ${claim.claimNo || claim.id}: prefix resolution failed — ${err.message}`);
    }

    try {
      if (!coreBenefitId && extraction.coreBenefit) {
        let benefitCategoryId = null;
        if (extraction.benefitCategory) {
          const cat = resolveBenefitCategoryFromCache(extraction.benefitCategory, benefitCategoryCache);
          if (cat) {
            benefitCategoryId = cat.id;
            benefitCategoryName = cat.name;
          }
        }
        coreBenefitText = extraction.coreBenefit;
        if (!dryRun) {
          const cb = await resolveOrCreateCoreBenefit(extraction.coreBenefit, benefitCategoryId);
          if (cb) coreBenefitId = cb.id;
          await new Promise(r => setTimeout(r, NOTION_WRITE_DELAY_MS));
        }
      }
    } catch (err) {
      log(`[warn] ${claim.claimNo || claim.id}: core-benefit resolution failed — ${err.message}`);
    }

    const wantsUpdate =
      (!claim.claimPrefixId && claimPrefixId) ||
      (!claim.coreBenefitId && coreBenefitId);

    if (!wantsUpdate && !(dryRun && (prefixText || coreBenefitText))) {
      results.skipped.push({ ...audit, reason: 'no resolvable prefix or core benefit' });
      results.summary.skipped++;
      log(`[skip] ${claim.claimNo || claim.id}: nothing to update (extracted prefix="${extraction.prefix}", coreBenefit="${extraction.coreBenefit}")`);
      continue;
    }

    const proposed = {
      ...audit,
      extracted: extraction,
      resolved: {
        prefix: prefixText,
        coreBenefit: coreBenefitText,
        benefitCategory: benefitCategoryName,
      },
      claimPrefixId: claimPrefixId || null,
      coreBenefitId: coreBenefitId || null,
    };

    if (dryRun) {
      results.updated.push({ ...proposed, dryRun: true });
      results.summary.updated++;
      log(`[dry] ${claim.claimNo || claim.id}: prefix="${prefixText || '∅'}" coreBenefit="${coreBenefitText || '∅'}" category="${benefitCategoryName || '∅'}"`);
      continue;
    }

    try {
      const update = {};
      if (!claim.claimPrefixId && claimPrefixId) update.claimPrefixId = claimPrefixId;
      if (!claim.coreBenefitId && coreBenefitId) update.coreBenefitId = coreBenefitId;
      await updateClaim(claim.id, update);
      await new Promise(r => setTimeout(r, NOTION_WRITE_DELAY_MS));
      results.updated.push(proposed);
      results.summary.updated++;
      log(`[ok]  ${claim.claimNo || claim.id}: prefix="${prefixText || '∅'}" coreBenefit="${coreBenefitText || '∅'}" category="${benefitCategoryName || '∅'}"`);
    } catch (err) {
      results.failed.push({ ...audit, reason: `updateClaim failed: ${err.message}` });
      results.summary.failed++;
      log(`[fail] ${claim.claimNo || claim.id}: updateClaim — ${err.message}`);
    }
  }

  return results;
}

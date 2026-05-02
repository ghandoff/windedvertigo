/**
 * PCS post-commit sanity checks.
 *
 * Heuristic warnings emitted after a successful commit to flag likely-bad
 * extractions (empty claim list, missing PCS ID, bucket-3A claims with no
 * evidence, etc.). Callers prefix each with "[SANITY] " before merging into
 * the job's Warnings field.
 *
 * Added 2026-04-19 as part of the batch-import feature (v1).
 */

/**
 * Post-commit sanity checks. Returns array of human-readable warning
 * strings, prefixed with "[SANITY]" by callers. Never throws.
 *
 * @param {object} extraction - The parsed extraction JSON that was committed.
 * @param {object} commitResult - The result object returned by commitExtraction.
 * @returns {string[]} Zero or more warning strings.
 */
export function runSanityChecks(extraction, commitResult) {
  const warnings = [];
  if (!extraction?.document?.pcsId) warnings.push('Missing PCS ID in extraction');
  if (!commitResult?.claimIds?.length) warnings.push('No claims were created — PCS documents typically have 5–20 claims');
  if (!commitResult?.formulaLineIds?.length) warnings.push('No formula lines — every PCS has ≥1 ingredient');
  const bucket3aClaims = (extraction?.claims || []).filter(c => c.claimBucket === '3A').length;
  if (bucket3aClaims > 0 && !commitResult?.evidencePacketIds?.length) {
    warnings.push(`No evidence packets for ${bucket3aClaims} bucket-3A claims (typically each needs ≥1 evidence)`);
  }
  const noPrefixClaims = (extraction?.claims || []).filter(c => !c.prefix).length;
  if (noPrefixClaims > 0) warnings.push(`${noPrefixClaims} claims have no prefix (may not bind to canonical taxonomy)`);
  const unmatchedAiLines = (extraction?.formulaLines || []).filter(f => f.ai && !f.activeIngredientCanonicalId).length;
  if (unmatchedAiLines > 0) warnings.push(`${unmatchedAiLines} formula lines reference AIs not in CAIPB canonicals`);
  return warnings;
}

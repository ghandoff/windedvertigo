/**
 * Classify a PCS document by which template version it follows.
 * Inspects the extraction JSON for signals that it matches Lauren Bozzio's
 * 10-table template vs the pre-Lauren legacy format. Used at commit time
 * to tag PCS Documents for re-issue tracking.
 *
 * Pure function — no Notion dependency.
 *
 * Added 2026-04-21 as part of Wave 3.7 (template-version classification).
 *
 * @param {object} extraction — full extractFromPdf() output
 * @returns {{
 *   templateVersion: 'Lauren v1.0' | 'Lauren v1.0 partial' | 'Legacy pre-Lauren' | 'Unknown',
 *   positiveCount: number,
 *   negativeCount: number,
 *   signals: { positive: string[], negative: string[] }
 * }}
 */
export function classifyTemplate(extraction) {
  const signals = { positive: [], negative: [] };
  const doc = extraction?.document || {};
  const version = extraction?.version || {};
  const formulaLines = Array.isArray(extraction?.formulaLines) ? extraction.formulaLines : [];
  const claims = Array.isArray(extraction?.claims) ? extraction.claims : [];
  const revisionHistory = Array.isArray(extraction?.revisionHistory) ? extraction.revisionHistory : [];
  const evidencePackets = Array.isArray(extraction?.evidencePackets) ? extraction.evidencePackets : [];

  // 1. Table B — Finished Good + FMT (SKUs explicitly NOT required)
  if (doc.finishedGoodName && doc.fmt) signals.positive.push('Table B populated (Finished Good + FMT)');
  else signals.negative.push('missing Table B (no finishedGoodName + fmt)');

  // 2. Multi-axis demographic (Wave 4.1a — count populated axes across 4 orthogonal dimensions)
  const axes = ['biologicalSex', 'ageGroup', 'lifeStage', 'lifestyle'];
  const populatedAxes = axes.filter(k => Array.isArray(version[k]) && version[k].length > 0);
  if (populatedAxes.length >= 2) {
    signals.positive.push(`Demographic multi-axis (${populatedAxes.length} axes: ${populatedAxes.join(', ')})`);
  } else if (populatedAxes.length === 1) {
    signals.negative.push(`Demographic is single-axis (${populatedAxes[0]} only)`);
  } else {
    // Fall back to legacy flat `demographic` field if the new axes are empty
    const legacyDemo = Array.isArray(version.demographic) ? version.demographic : [];
    if (legacyDemo.length >= 2) signals.positive.push(`Demographic multi-axis (legacy, ${legacyDemo.length} entries)`);
    else if (legacyDemo.length === 1) signals.negative.push('Demographic is single-axis (legacy)');
    else signals.negative.push('Demographic empty');
  }

  // 3. FM PLM# on any formula line
  const withFmPlm = formulaLines.filter(f => f.fmPlm).length;
  if (withFmPlm > 0) signals.positive.push(`${withFmPlm} formula line(s) have FM PLM#`);
  else if (formulaLines.length > 0) signals.negative.push('No formula lines have FM PLM#');

  // 4. AI Source on any formula line
  const withSource = formulaLines.filter(f => f.ingredientSource).length;
  if (withSource > 0) signals.positive.push(`${withSource} formula line(s) have AI Source`);

  // 5. FC/FM prefix pattern on revision events
  const withFcPrefix = revisionHistory.filter(r => /^(FC|FM)\s*[–\-]/.test(r.activityType || '')).length;
  if (withFcPrefix > 0) signals.positive.push(`${withFcPrefix} revision event(s) use FC/FM prefix`);
  else if (revisionHistory.length > 0) signals.negative.push('No revision events use FC/FM prefix');

  // 6. Claims have Status + No
  const claimsWithStatusAndNo = claims.filter(c => c.claimStatus && c.claimNo != null && c.claimNo !== '').length;
  if (claimsWithStatusAndNo > 0) signals.positive.push(`${claimsWithStatusAndNo} claim(s) have Status + No`);
  else if (claims.length > 0) signals.negative.push('Claims lack Status + No');

  // 7a. Wave 4.5.5 — claim extractor confidence signal. If the extraction carries
  // per-claim confidence scores and >25% fall below the backfill threshold (0.7),
  // flag as a negative signal so low-confidence imports surface in the batch UI.
  const THRESHOLD = 0.7;
  const claimsWithConf = claims.filter(c => typeof c.confidence === 'number');
  if (claimsWithConf.length > 0) {
    const lowConf = claimsWithConf.filter(c => c.confidence < THRESHOLD).length;
    const pct = lowConf / claimsWithConf.length;
    if (pct > 0.25) {
      signals.negative.push(`${lowConf}/${claimsWithConf.length} claim(s) extracted with confidence < ${THRESHOLD} (${Math.round(pct * 100)}%)`);
    } else if (lowConf > 0) {
      signals.positive.push(`${claimsWithConf.length - lowConf}/${claimsWithConf.length} claim(s) extracted with confidence ≥ ${THRESHOLD}`);
    }
  }

  // 7. Evidence packet Table 4 narrative fields
  const withTable4 = evidencePackets.filter(e =>
    e.substantiationTier || e.keyTakeaway || e.studyDesignSummary
  ).length;
  if (withTable4 > 0) signals.positive.push(`${withTable4} evidence packet(s) have Table 4 narrative`);
  else if (evidencePackets.length > 0) signals.negative.push('Evidence packets lack Table 4 narrative fields');

  const positiveCount = signals.positive.length;
  let templateVersion;
  if (positiveCount >= 5) templateVersion = 'Lauren v1.0';
  else if (positiveCount >= 2) templateVersion = 'Lauren v1.0 partial';
  else templateVersion = 'Legacy pre-Lauren';

  return {
    templateVersion,
    positiveCount,
    negativeCount: signals.negative.length,
    signals,
  };
}

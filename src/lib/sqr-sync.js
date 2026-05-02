/**
 * SQR-RCT → PCS Evidence Library sync logic.
 *
 * Extracted from the admin sync endpoint for reuse in:
 * 1. Manual bulk sync (POST /api/admin/sync/evidence)
 * 2. Auto-sync on score submission (POST /api/scores)
 *
 * Auto-sync is gated by the PCS_AUTO_SYNC env var:
 *   - "true"  → scores auto-propagate to PCS on submission
 *   - unset/other → manual sync only (RA controls timing)
 */

import { getScoresForStudy } from './notion.js';
import { getQualityTier } from './rubric.js';
import { normalizeDoi } from './doi.js';
import { getAllEvidenceEntries, updateEvidenceEntry, getPacketsForEvidence, updatePacketThreshold } from './pcs.js';
import { createEvidence } from './pcs-evidence.js';

const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];

const RISK_OF_BIAS_MAP = {
  'High Quality': 'Low',
  'Moderate Quality': 'Some concerns',
  'Low Quality': 'High',
};

function getTotal(score) {
  return QUESTION_IDS.reduce((sum, q) => sum + (score[q] ?? 0), 0);
}

/**
 * Check whether auto-sync is enabled.
 */
export function isAutoSyncEnabled() {
  return process.env.PCS_AUTO_SYNC === 'true';
}

/**
 * Sync a single study's SQR-RCT scores to its PCS evidence entry.
 * If no matching PCS entry exists, auto-creates one from the study metadata.
 *
 * @param {string} studyId — Notion page ID of the study
 * @param {string} studyDoi — DOI of the study (raw, will be normalized)
 * @param {object} [studyData] — Full study object from parseIntakePage (optional, for auto-create)
 * @returns {{ status, details }} — result of the sync attempt
 */
export async function syncStudyToPcs(studyId, studyDoi, studyData = null) {
  const normalizedDoi = normalizeDoi(studyDoi);
  if (!normalizedDoi) {
    return { status: 'skipped', reason: 'no valid DOI' };
  }

  // Find matching PCS evidence entry
  const evidenceEntries = await getAllEvidenceEntries();
  let pcsEntry = null;
  for (const entry of evidenceEntries) {
    if (normalizeDoi(entry.doi) === normalizedDoi) {
      pcsEntry = entry;
      break;
    }
  }

  // Auto-create PCS evidence entry if none exists
  let wasCreated = false;
  if (!pcsEntry && studyData) {
    try {
      pcsEntry = await createEvidence({
        name: studyData.citation || `Study ${normalizedDoi}`,
        citation: studyData.citation || '',
        doi: normalizedDoi,
        url: studyData.doi?.startsWith('http') ? studyData.doi : `https://doi.org/${normalizedDoi}`,
        publicationYear: studyData.year || null,
        pdf: studyData.pdf || null,
      });
      wasCreated = true;
    } catch (err) {
      return { status: 'error', reason: `Failed to create PCS entry: ${err.message}` };
    }
  }

  if (!pcsEntry) {
    return { status: 'unmatched', reason: 'no PCS evidence entry with this DOI' };
  }

  // Get all scores for this study
  const studyScores = await getScoresForStudy(studyId);
  if (studyScores.length === 0) {
    return { status: 'skipped', reason: 'no scores' };
  }

  // Dedup by rater, keep latest per reviewer
  const byRater = {};
  for (const s of studyScores) {
    if (!byRater[s.raterAlias] || s.timestamp > byRater[s.raterAlias].timestamp) {
      byRater[s.raterAlias] = s;
    }
  }
  const uniqueScores = Object.values(byRater);

  // Average composite totals
  const totals = uniqueScores.map(s => getTotal(s));
  const avgScore = totals.reduce((a, b) => a + b, 0) / totals.length;
  const roundedAvg = Math.round(avgScore * 10) / 10;

  // Map to quality tier and risk of bias
  const tier = getQualityTier(Math.round(avgScore));
  const riskOfBias = RISK_OF_BIAS_MAP[tier.label];

  // Latest timestamp for review date
  const latestTimestamp = uniqueScores.reduce(
    (latest, s) => (s.timestamp > latest ? s.timestamp : latest),
    uniqueScores[0].timestamp,
  );
  const reviewDate = latestTimestamp.split('T')[0];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const reviewUrl = `${appUrl}/analytics`;

  // Idempotency check
  if (
    pcsEntry.sqrScore === roundedAvg &&
    pcsEntry.sqrRiskOfBias === riskOfBias &&
    pcsEntry.sqrReviewed === true
  ) {
    return { status: 'unchanged', pcsEntryId: pcsEntry.id };
  }

  // Write to PCS
  await updateEvidenceEntry(pcsEntry.id, {
    score: roundedAvg,
    riskOfBias,
    reviewDate,
    reviewUrl,
  });

  // Update evidence packets threshold
  const meetsThreshold = roundedAvg >= 17;
  const packets = await getPacketsForEvidence(pcsEntry.id);
  let packetsUpdated = 0;
  for (const packet of packets) {
    if (packet.meetsThreshold !== meetsThreshold) {
      await updatePacketThreshold(packet.id, meetsThreshold);
      packetsUpdated++;
    }
  }

  return {
    status: wasCreated ? 'created' : 'updated',
    pcsEntryId: pcsEntry.id,
    pcsName: pcsEntry.name,
    avgScore: roundedAvg,
    riskOfBias,
    reviewerCount: uniqueScores.length,
    packetsUpdated,
  };
}

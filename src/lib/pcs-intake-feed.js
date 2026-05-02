/**
 * PCS Evidence Library → SQR-RCT Intake feed.
 *
 * When an evidence item is added to the PCS library (or manually triggered),
 * this module creates a corresponding SQR-RCT intake entry so distributed
 * reviewers can score it. Only study types eligible for SQR review are routed.
 *
 * Auto-feed is gated by the PCS_AUTO_FEED env var:
 *   - "true"  → new evidence items auto-create intake entries
 *   - unset   → manual trigger only (via "Send to SQR-RCT Review" button)
 *
 * The reverse direction (SQR-RCT scores → PCS) is handled by sqr-sync.js.
 */

import { createStudy, getStudyByDoi } from './notion.js';
import { normalizeDoi } from './doi.js';

// Evidence types eligible for SQR-RCT quality review
const REVIEWABLE_TYPES = new Set([
  'RCT',
  'Observational',
  'Meta-analysis',
  'Systematic review',
]);

/**
 * Check whether auto-feed is enabled.
 */
export function isAutoFeedEnabled() {
  return process.env.PCS_AUTO_FEED === 'true';
}

/**
 * Feed a PCS evidence item into the SQR-RCT intake queue.
 *
 * @param {Object} evidence — parsed PCS evidence entry (from pcs-evidence.js)
 * @returns {{ status, reason?, intakeId?, intakeCitation? }}
 */
export async function feedToIntake(evidence) {
  // 1. Check evidence type is reviewable
  if (!evidence.evidenceType || !REVIEWABLE_TYPES.has(evidence.evidenceType)) {
    return {
      status: 'skipped',
      reason: `evidence type "${evidence.evidenceType || 'none'}" not eligible for SQR review`,
    };
  }

  // 2. Require a DOI — it's the cross-system link
  const normalized = normalizeDoi(evidence.doi);
  if (!normalized) {
    return { status: 'skipped', reason: 'no valid DOI' };
  }

  // 3. Check for existing intake entry (dedup by DOI)
  // SQR-RCT stores DOI as a URL, so pass the full URL form
  const doiUrl = `https://doi.org/${normalized}`;
  const existing = await getStudyByDoi(doiUrl);
  if (existing) {
    return {
      status: 'duplicate',
      reason: 'intake entry already exists for this DOI',
      intakeId: existing.id,
      intakeCitation: existing.citation,
    };
  }

  // 4. Map PCS evidence fields → SQR-RCT intake fields
  const intakeData = {
    citation: evidence.name || evidence.citation || 'Untitled',
    doi: doiUrl,
    year: evidence.publicationYear || null,
    journal: extractJournal(evidence.citation) || '',
    studyDesign: mapEvidenceTypeToDesign(evidence.evidenceType),
    submittedByAlias: 'PCS-auto',
  };

  // 5. Create the intake entry
  const page = await createStudy(intakeData);

  return {
    status: 'created',
    intakeId: page.id,
    intakeCitation: intakeData.citation,
    doi: normalized,
  };
}

/**
 * Batch feed multiple evidence items. Returns per-item results.
 */
export async function feedBatchToIntake(evidenceItems) {
  const results = [];
  for (const item of evidenceItems) {
    try {
      const result = await feedToIntake(item);
      results.push({ id: item.id, name: item.name, ...result });
    } catch (err) {
      results.push({ id: item.id, name: item.name, status: 'error', reason: err.message });
    }
    // Notion rate limit: 3 req/sec — pause between items
    await new Promise(r => setTimeout(r, 350));
  }
  return results;
}

/**
 * Extract journal name from a formatted citation string.
 * Citations are typically: "Authors. Title. Journal. Year;Vol(Issue):Pages."
 */
function extractJournal(citation) {
  if (!citation) return '';
  const parts = citation.split('. ');
  // Journal is usually the 3rd segment in standard citation format
  if (parts.length >= 3) return parts[2].replace(/\.$/, '');
  return '';
}

/**
 * Map PCS evidence type to a study design description for the intake form.
 */
function mapEvidenceTypeToDesign(evidenceType) {
  const MAP = {
    'RCT': 'Randomized Controlled Trial',
    'Observational': 'Observational Study',
    'Meta-analysis': 'Meta-analysis',
    'Systematic review': 'Systematic Review',
  };
  return MAP[evidenceType] || evidenceType || '';
}

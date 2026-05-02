import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllStudies, getAllScores } from '@/lib/notion';
import { getQualityTier } from '@/lib/rubric';
import { normalizeDoi } from '@/lib/doi';
import {
  getAllEvidenceEntries,
  updateEvidenceEntry,
  getPacketsForEvidence,
  updatePacketThreshold,
} from '@/lib/pcs';
import { createEvidence } from '@/lib/pcs-evidence';

export const maxDuration = 120;

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
 * POST /api/admin/sync/evidence
 *
 * Syncs SQR-RCT quality scores → PCS Evidence Library entries by DOI.
 *
 * Query params:
 *   dry_run=true       — preview changes without writing
 *   update_packets=true — also update Evidence Packets threshold
 */
export async function POST(request) {
  // ── Phase 1: Auth — Wave 7.5 Batch C capability gate ───────────────
  const gate = await requireCapability(request, 'pcs.evidence:edit', { route: '/api/admin/sync/evidence' });
  if (gate.error) return gate.error;

  // ── Phase 2: Parse options ─────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';
  const updatePackets = searchParams.get('update_packets') === 'true';

  const results = {
    matched: [],
    updated: [],
    unchanged: [],
    created: [],
    unmatched: [],
    skipped: [],
    errors: [],
    packetsUpdated: [],
  };

  try {
    // ── Phase 3: Fetch SQR-RCT data ───────────────────────────────────
    const [studies, allScores] = await Promise.all([
      getAllStudies(),
      getAllScores(),
    ]);

    // ── Phase 4: Fetch PCS Evidence Library ───────────────────────────
    const evidenceEntries = await getAllEvidenceEntries();

    // ── Phase 5: Build DOI lookup maps ────────────────────────────────

    // PCS evidence indexed by normalized DOI
    const pcsMap = new Map();
    for (const entry of evidenceEntries) {
      const normalized = normalizeDoi(entry.doi);
      if (normalized) pcsMap.set(normalized, entry);
    }

    // Group SQR-RCT scores by study page ID
    const scoresByStudy = {};
    for (const score of allScores) {
      const studyId = score.studyRelation?.[0];
      if (!studyId) continue;
      if (!scoresByStudy[studyId]) scoresByStudy[studyId] = [];
      scoresByStudy[studyId].push(score);
    }

    // ── Phase 6: Match + aggregate ────────────────────────────────────

    // Deduplicate studies by normalized DOI (same pattern as statistics.js)
    const studiesByDoi = {};
    for (const study of studies) {
      const normalized = normalizeDoi(study.doi);
      if (!normalized) {
        results.skipped.push({ id: study.id, citation: study.citation, reason: 'no DOI' });
        continue;
      }
      if (!studiesByDoi[normalized]) studiesByDoi[normalized] = [];
      studiesByDoi[normalized].push(study);
    }

    for (const [normalizedDoi, doiStudies] of Object.entries(studiesByDoi)) {
      let pcsEntry = pcsMap.get(normalizedDoi);

      // Auto-create PCS evidence entry for reviewed studies with no match
      if (!pcsEntry) {
        // Check if this study has any scores before creating
        const studyIds = doiStudies.map(s => s.id);
        const hasScores = studyIds.some(id => scoresByStudy[id]?.length > 0);

        if (hasScores && !dryRun) {
          try {
            const study = doiStudies[0];
            pcsEntry = await createEvidence({
              name: study.citation || `Study ${normalizedDoi}`,
              citation: study.citation || '',
              doi: normalizedDoi,
              url: study.doi?.startsWith('http') ? study.doi : `https://doi.org/${normalizedDoi}`,
              publicationYear: study.year || null,
              pdf: study.pdf || null,
            });
            results.created.push({
              pcsEntryId: pcsEntry.id,
              doi: normalizedDoi,
              citation: study.citation,
            });
            await new Promise(r => setTimeout(r, 350));
          } catch (err) {
            console.error('[sync] Create failed for DOI:', normalizedDoi, err.message, err.body || '');
            results.errors.push({ doi: normalizedDoi, error: `Create failed: ${err.message}` });
            continue;
          }
        } else if (hasScores && dryRun) {
          results.created.push({
            doi: normalizedDoi,
            citation: doiStudies[0].citation,
            wouldCreate: true,
          });
          // Still need a pcsEntry-like object for dry run matching logic below
          pcsEntry = { id: 'dry-run', name: doiStudies[0].citation, sqrScore: null, sqrRiskOfBias: null, sqrReviewed: false };
        } else {
          results.unmatched.push({
            doi: normalizedDoi,
            citation: doiStudies[0].citation,
          });
          continue;
        }
      }

      // Collect all scores across intake pages sharing the same DOI
      const studyIds = doiStudies.map(s => s.id);
      const allStudyScores = studyIds.flatMap(id => scoresByStudy[id] || []);

      if (allStudyScores.length === 0) {
        results.skipped.push({
          id: doiStudies[0].id,
          citation: doiStudies[0].citation,
          reason: 'no scores',
        });
        continue;
      }

      // Dedup by rater alias, keep latest per reviewer
      const byRater = {};
      for (const s of allStudyScores) {
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

      // Build base URL for review link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const reviewUrl = `${appUrl}/analytics`;

      results.matched.push({
        pcsEntryId: pcsEntry.id,
        pcsName: pcsEntry.name,
        doi: normalizedDoi,
        avgScore: roundedAvg,
        riskOfBias,
        reviewerCount: uniqueScores.length,
        reviewDate,
      });

      // Idempotency check — skip if values haven't changed
      if (
        pcsEntry.sqrScore === roundedAvg &&
        pcsEntry.sqrRiskOfBias === riskOfBias &&
        pcsEntry.sqrReviewed === true
      ) {
        results.unchanged.push(pcsEntry.id);
        continue;
      }

      // ── Phase 7: Write (or skip for dry run) ──────────────────────────
      if (!dryRun) {
        try {
          await updateEvidenceEntry(pcsEntry.id, {
            score: roundedAvg,
            riskOfBias,
            reviewDate,
            reviewUrl,
          });
          results.updated.push(pcsEntry.id);
          // rate limit: 350ms between writes
          await new Promise(r => setTimeout(r, 350));
        } catch (err) {
          results.errors.push({ pageId: pcsEntry.id, error: err.message });
        }
      } else {
        results.updated.push(pcsEntry.id);
      }
    }

    // ── Phase 8: Evidence Packets threshold ───────────────────────────
    if (updatePackets && !dryRun) {
      for (const match of results.matched) {
        const meetsThreshold = match.avgScore >= 17;
        try {
          const packets = await getPacketsForEvidence(match.pcsEntryId);
          for (const packet of packets) {
            if (packet.meetsThreshold !== meetsThreshold) {
              await updatePacketThreshold(packet.id, meetsThreshold);
              results.packetsUpdated.push(packet.id);
              await new Promise(r => setTimeout(r, 350));
            }
          }
        } catch (err) {
          results.errors.push({
            pageId: match.pcsEntryId,
            error: `Packet update failed: ${err.message}`,
          });
        }
      }
    }

    // ── Phase 9: Response ─────────────────────────────────────────────
    return NextResponse.json({
      summary: {
        totalSqrStudies: studies.length,
        totalEvidenceEntries: evidenceEntries.length,
        matched: results.matched.length,
        updated: results.updated.length,
        unchanged: results.unchanged.length,
        created: results.created.length,
        unmatched: results.unmatched.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        packetsUpdated: results.packetsUpdated.length,
        dryRun,
      },
      details: {
        matched: results.matched,
        created: results.created,
        unmatched: results.unmatched,
        skipped: results.skipped,
        errors: results.errors,
      },
    });
  } catch (err) {
    console.error('Sync failed:', err);
    return NextResponse.json(
      { error: 'Sync failed', message: err.message },
      { status: 500 },
    );
  }
}

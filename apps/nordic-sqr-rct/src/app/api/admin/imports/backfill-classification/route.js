import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllDocuments, updateDocument } from '@/lib/pcs-documents';
import { getVersionsForDocument, getVersion } from '@/lib/pcs-versions';
import { getClaimsForVersion } from '@/lib/pcs-claims';
import { getFormulaLinesForVersion } from '@/lib/pcs-formula-lines';
import { classifyTemplate } from '@/lib/pcs-template-classifier';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/imports/backfill-classification
 *
 * Runs the template-version classifier against every PCS Document
 * already committed in Notion. Used once after Wave 3.7 ships to
 * populate `Template version` on pre-existing records.
 *
 * Query params:
 *   ?dry_run=true  — log planned updates, write nothing
 *   ?limit=N       — cap processed docs
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:backfill-classification', { route: '/api/admin/imports/backfill-classification' });
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit'), 10) : null;

  const docs = await getAllDocuments();
  const target = limit ? docs.slice(0, limit) : docs;
  const results = { processed: 0, classified: {}, errors: [] };

  for (const doc of target) {
    try {
      // Reconstruct a minimal extraction from Notion
      const versions = await getVersionsForDocument(doc.id);
      const latest = versions.find(v => v.isLatest)
        || versions.sort((a, b) => (b.lastEditedTime || '').localeCompare(a.lastEditedTime || ''))[0];
      if (!latest) {
        results.errors.push({ pcsId: doc.pcsId, error: 'no version found' });
        continue;
      }
      const version = await getVersion(latest.id);
      const [claims, formulaLines] = await Promise.all([
        getClaimsForVersion(latest.id),
        getFormulaLinesForVersion(latest.id),
      ]);
      // Note: revisionHistory + evidencePackets not fetched in backfill for simplicity
      // — the classifier degrades gracefully (just misses those signals).
      const extraction = {
        document: {
          finishedGoodName: doc.finishedGoodName,
          fmt: doc.format,
          sapMaterialNo: doc.sapMaterialNo,
          skus: doc.skus || [],
        },
        version: {
          productName: version.productName,
          demographic: version.demographic || [],
          // Demographic axes (Wave 4.1a) — classifier now counts populated axes
          biologicalSex: version.biologicalSex || [],
          ageGroup:      version.ageGroup      || [],
          lifeStage:     version.lifeStage     || [],
          lifestyle:     version.lifestyle     || [],
        },
        formulaLines,
        claims,
        revisionHistory: [],
        evidencePackets: [],
      };

      const classification = classifyTemplate(extraction);
      const signalsText = [
        `Positive (${classification.signals.positive.length}): ${classification.signals.positive.join('; ') || 'none'}`,
        `Negative (${classification.signals.negative.length}): ${classification.signals.negative.join('; ') || 'none'}`,
      ].join('\n');

      if (!dryRun) {
        await updateDocument(doc.id, {
          templateVersion: classification.templateVersion,
          templateSignals: signalsText,
        });
      }

      results.processed++;
      results.classified[classification.templateVersion] = (results.classified[classification.templateVersion] || 0) + 1;
    } catch (err) {
      results.errors.push({ pcsId: doc.pcsId, error: err?.message || String(err) });
    }
  }

  return NextResponse.json({ dryRun, ...results, total: target.length });
}

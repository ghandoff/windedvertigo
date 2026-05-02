import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllDocuments, getDocument } from '@/lib/pcs-documents';
import { getAllClaims, getClaimsForVersion } from '@/lib/pcs-claims';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { getAllEvidencePackets, getPacketsForClaim } from '@/lib/pcs-evidence-packets';
import { getAllRequests } from '@/lib/pcs-requests';
import { getVersion, getVersionsForDocument } from '@/lib/pcs-versions';
import { getEventsForVersion } from '@/lib/pcs-revision-events';
import { getFormulaLinesForVersion } from '@/lib/pcs-formula-lines';
import { getReferencesForVersion } from '@/lib/pcs-references';
import {
  generateClaimsSummary,
  generateEvidenceReport,
  generateFullReport,
  generateLaurenTemplateDocx,
  packDocument,
} from '@/lib/pcs-docx';

/**
 * GET /api/pcs/export/docx?type=claims|evidence|full|lauren-template
 *
 * Generates a branded Word document (.docx) from PCS data.
 *
 * For `type=lauren-template`, pass `documentId=<id>` to target a single PCS.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.export:docx', { route: '/api/pcs/export/docx' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'claims';
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    let doc, filename;

    switch (type) {
      case 'claims': {
        const [claims, packets, evidence] = await Promise.all([
          getAllClaims(),
          getAllEvidencePackets(),
          getAllEvidence(),
        ]);
        doc = generateClaimsSummary(claims, packets, evidence);
        filename = `pcs-claims-summary-${dateStr}.docx`;
        break;
      }
      case 'evidence': {
        const [evidence, packets] = await Promise.all([
          getAllEvidence(),
          getAllEvidencePackets(),
        ]);
        doc = generateEvidenceReport(evidence, packets);
        filename = `pcs-evidence-library-${dateStr}.docx`;
        break;
      }
      case 'full': {
        const [documents, claims, evidence, packets, requests] = await Promise.all([
          getAllDocuments(),
          getAllClaims(),
          getAllEvidence(),
          getAllEvidencePackets(),
          getAllRequests(),
        ]);
        doc = generateFullReport(documents, claims, evidence, packets, requests);
        filename = `pcs-full-report-${dateStr}.docx`;
        break;
      }
      case 'lauren-template': {
        const documentId = searchParams.get('documentId');
        if (!documentId) {
          return NextResponse.json({ error: 'documentId query param is required for lauren-template export' }, { status: 400 });
        }

        const docRow = await getDocument(documentId).catch(() => null);
        if (!docRow) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Resolve latest version (same logic as the view API).
        let version = null;
        if (docRow.latestVersionId) {
          version = await getVersion(docRow.latestVersionId).catch(() => null);
        }
        if (!version) {
          const all = await getVersionsForDocument(documentId).catch(() => []);
          version = all.find(v => v.isLatest) || all[0] || null;
        }

        let revisionEvents = [];
        let formulaLines = [];
        let claims = [];
        let references = [];
        let evidencePackets = [];
        if (version?.id) {
          const [events, lines, claimRows, refRows] = await Promise.all([
            getEventsForVersion(version.id).catch(() => []),
            getFormulaLinesForVersion(version.id).catch(() => []),
            getClaimsForVersion(version.id).catch(() => []),
            getReferencesForVersion(version.id).catch(() => []),
          ]);
          revisionEvents = events;
          formulaLines = lines;
          claims = claimRows;
          references = refRows;

          // Aggregate evidence packets by walking this version's claims.
          const packetsByClaim = await Promise.all(
            claims.map(c => getPacketsForClaim(c.id).catch(() => [])),
          );
          // De-duplicate by packet id in case multiple claims share a packet.
          const seen = new Set();
          evidencePackets = [];
          for (const arr of packetsByClaim) {
            for (const p of arr) {
              if (p?.id && !seen.has(p.id)) {
                seen.add(p.id);
                evidencePackets.push(p);
              }
            }
          }
        }

        doc = generateLaurenTemplateDocx(
          docRow, version, claims, formulaLines, evidencePackets, revisionEvents, references,
        );

        const fmtPart = (docRow.format || 'format').replace(/\s+/g, '-');
        const idPart = docRow.pcsId || documentId;
        const vPart = version?.version ? `v${version.version}` : 'v-';
        filename = `PCS-${idPart}_${fmtPart}_${vPart}_${dateStr}.docx`;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown report type: ${type}. Use: claims, evidence, full, lauren-template` }, { status: 400 });
    }

    const buffer = await packDocument(doc);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('DOCX export error:', error);
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 });
  }
}

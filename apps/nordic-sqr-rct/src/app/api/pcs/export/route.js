import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllDocuments } from '@/lib/pcs-documents';
import { getAllClaims } from '@/lib/pcs-claims';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { getAllRequests } from '@/lib/pcs-requests';

function escapeCSV(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(headers, rows) {
  const lines = [headers.map(escapeCSV).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(','));
  }
  return lines.join('\n');
}

/**
 * GET /api/pcs/export?type=documents|claims|evidence|requests&format=csv
 *
 * Export PCS data as CSV.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.export:pdf', { route: '/api/pcs/export' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'documents';
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    let csv, filename;

    switch (type) {
      case 'documents': {
        const docs = await getAllDocuments();
        csv = toCSV(
          ['PCS ID', 'Classification', 'File Status', 'Product Status', 'Approved Date', 'Notes'],
          docs.map(d => [d.pcsId, d.classification, d.fileStatus, d.productStatus, d.approvedDate, d.documentNotes])
        );
        filename = `pcs-documents-${dateStr}.csv`;
        break;
      }
      case 'claims': {
        const claims = await getAllClaims();
        csv = toCSV(
          ['#', 'Claim', 'Bucket', 'Status', 'Disclaimer', 'Notes', 'Evidence Count'],
          claims.map(c => [
            c.claimNo, c.claim, c.claimBucket, c.claimStatus,
            c.disclaimerRequired ? 'Yes' : 'No', c.claimNotes,
            c.evidencePacketIds?.length || 0,
          ])
        );
        filename = `pcs-claims-${dateStr}.csv`;
        break;
      }
      case 'evidence': {
        const evidence = await getAllEvidence();
        csv = toCSV(
          ['Name', 'DOI', 'PMID', 'Type', 'Ingredients', 'Year', 'SQR Score', 'Reviewed', 'Summary'],
          evidence.map(e => [
            e.name, e.doi, e.pmid, e.evidenceType,
            e.ingredient?.join('; ') || '', e.publicationYear,
            e.sqrScore, e.sqrReviewed ? 'Yes' : 'No', e.canonicalSummary,
          ])
        );
        filename = `pcs-evidence-${dateStr}.csv`;
        break;
      }
      case 'requests': {
        const requests = await getAllRequests();
        csv = toCSV(
          ['Request', 'Status', 'Requested By', 'RA Due', 'RES Due', 'RA Completed', 'RES Completed', 'Notes'],
          requests.map(r => [
            r.request, r.status, r.requestedBy,
            r.raDue, r.resDue, r.raCompleted, r.resCompleted, r.requestNotes,
          ])
        );
        filename = `pcs-requests-${dateStr}.csv`;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
    }

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PCS export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

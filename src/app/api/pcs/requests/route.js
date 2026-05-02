import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllRequests, getRequestsByStatus, getOpenRequests,
  getRequestsForVersion, getRequestsForDocument, createRequest,
  queryRequests,
} from '@/lib/pcs-requests';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.requests:read', { route: '/api/pcs/requests' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const versionId = searchParams.get('versionId');
  const documentId = searchParams.get('documentId');
  const open = searchParams.get('open');
  const filter = searchParams.get('filter'); // 'mine' | 'all' | 'aged' | 'critical'
  const assigneeId = searchParams.get('assigneeId');

  // Wave 4.5.1 filter=* queries — unified path used by the new /pcs/requests page
  // and the document-detail Outstanding Requests card.
  if (filter) {
    const rows = await queryRequests({ filter, documentId, assigneeId });
    return NextResponse.json(rows);
  }

  // Document-scoped query for the /pcs/documents/[id] page.
  if (documentId) {
    const rows = await getRequestsForDocument(documentId, { openOnly: status === 'open' });
    return NextResponse.json(rows);
  }

  let requests;
  if (versionId) {
    requests = await getRequestsForVersion(versionId);
  } else if (status) {
    requests = await getRequestsByStatus(status);
  } else if (open === 'true') {
    requests = await getOpenRequests();
  } else {
    requests = await getAllRequests();
  }
  return NextResponse.json(requests);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.requests:create', { route: '/api/pcs/requests' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.request) {
    return NextResponse.json({ error: 'request title is required' }, { status: 400 });
  }
  const req = await createRequest(fields);
  return NextResponse.json(req, { status: 201 });
}

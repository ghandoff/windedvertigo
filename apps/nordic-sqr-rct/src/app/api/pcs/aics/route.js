import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { listAicsDocuments, createAicsDocument } from '@/lib/aics-documents';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireCapability(request, 'aics.documents:read', { route: '/api/pcs/aics' });
  if (auth.error) return auth.error;

  const { user } = auth;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const demographic = searchParams.get('demographic') || undefined;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Number(searchParams.get('limit') || 100);

  // AICS Broadcasting: contractors see only their assigned documents.
  const isAicsReviewerOnly =
    Array.isArray(user?.roles) &&
    user.roles.includes('aics-reviewer') &&
    !user.roles.some(r => ['ra', 'researcher', 'admin', 'super-user'].includes(r));

  const result = await listAicsDocuments({
    limit, cursor, status, demographic,
    assignedReviewerId: isAicsReviewerOnly ? user.reviewerId : undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'aics.documents:create', { route: '/api/pcs/aics' });
  if (auth.error) return auth.error;

  let fields;
  try {
    fields = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!fields?.aicsId) {
    return NextResponse.json({ error: 'aicsId is required' }, { status: 400 });
  }
  try {
    const doc = await createAicsDocument(fields);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    const msg = err?.message || 'Failed to create AICS document';
    const status = msg.includes('not configured') ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

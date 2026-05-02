import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getApplicabilityById,
  updateApplicability,
  deleteApplicability,
} from '@/lib/applicability';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.applicability:read', { route: '/api/pcs/applicability/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getApplicabilityById(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.applicability:edit', { route: '/api/pcs/applicability/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  const row = await updateApplicability(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.applicability:edit', { route: '/api/pcs/applicability/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deleteApplicability(id);
  return NextResponse.json({ ok: true });
}

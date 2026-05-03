import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getControlledVocabBundle } from '@/lib/pcs-controlled-vocab';

/**
 * GET /api/pcs/cv — returns the entire controlled-vocabulary bundle in one
 * payload. Consumed by the PCS form-driven entry surface (Bundle 4 Phase 1)
 * which fetches once on mount and populates every dropdown from the result.
 *
 * Capability: `pcs.documents:read` (any PCS user can read CV).
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.documents:read', { route: '/api/pcs/cv' });
  if (auth.error) return auth.error;

  const bundle = getControlledVocabBundle();
  return NextResponse.json(bundle);
}

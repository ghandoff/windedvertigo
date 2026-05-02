import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { PROMPT_VERSION } from '@/lib/pcs-pdf-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/imports/prompt-version
 *
 * Returns the current PROMPT_VERSION string. The batch-import dashboard
 * fetches this on load so it can flag committed jobs that were extracted
 * under an older prompt (candidates for bulk re-extract).
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/admin/imports/prompt-version' });
  if (auth.error) return auth.error;

  return NextResponse.json({ current: PROMPT_VERSION });
}

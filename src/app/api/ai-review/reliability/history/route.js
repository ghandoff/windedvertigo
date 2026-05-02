import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { listReliabilityRuns, summarizeReliabilityRuns } from '@/lib/reliability-store';

export async function GET(request) {
  // Wave 7.5 Batch C — capability gate replaces authenticate + admin check.
  const gate = await requireCapability(request, 'sqr.ai-review:run', { route: '/api/ai-review/reliability/history' });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || undefined;
  const studyId = searchParams.get('studyId') || undefined;
  const rubricVersion = searchParams.get('rubricVersion') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

  const runs = listReliabilityRuns({ mode, studyId, rubricVersion, limit });
  const trend = summarizeReliabilityRuns();

  return NextResponse.json({
    runs,
    trend,
    note: 'Records are stored in process memory and may not persist across deploys or cold starts.',
  });
}

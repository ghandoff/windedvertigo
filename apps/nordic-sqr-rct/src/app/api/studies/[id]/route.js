import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getStudyById, getScoresForStudy } from '@/lib/notion';

export async function GET(request, { params }) {
  try {
    // Wave 7.5 Batch C — fetching a study with all its scores is a
    // read-all surface; gate on `sqr.scores:read-all`.
    const gate = await requireCapability(request, 'sqr.scores:read-all', { route: '/api/studies/[id]' });
    if (gate.error) return gate.error;
    const { id } = await params;
    const [study, scores] = await Promise.all([getStudyById(id), getScoresForStudy(id)]);
    return NextResponse.json({ study, scores });
  } catch (error) {
    console.error('Get study error:', error);
    return NextResponse.json({ error: 'Failed to fetch study' }, { status: 500 });
  }
}

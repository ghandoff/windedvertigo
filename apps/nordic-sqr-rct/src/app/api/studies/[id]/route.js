import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getStudyById, getScoresForStudy } from '@/lib/notion';

export async function GET(request, { params }) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const [study, scores] = await Promise.all([getStudyById(id), getScoresForStudy(id)]);
    return NextResponse.json({ study, scores });
  } catch (error) {
    console.error('Get study error:', error);
    return NextResponse.json({ error: 'Failed to fetch study' }, { status: 500 });
  }
}

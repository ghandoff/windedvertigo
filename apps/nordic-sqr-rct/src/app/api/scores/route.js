import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createScore, getScoresByReviewer, getAllScores, getScoresForStudy } from '@/lib/notion';
import { DEFAULT_RUBRIC_VERSION, RUBRIC_VERSIONS, getRubricByVersion } from '@/lib/rubric';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const reviewerAlias = searchParams.get('reviewer');
    let scores;
    if (reviewerAlias) { scores = await getScoresByReviewer(reviewerAlias); }
    else { scores = await getAllScores(); }
    return NextResponse.json({ scores });
  } catch (error) {
    console.error('Get scores error:', error);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const data = await request.json();

    // ── Validate studyId ──────────────────────────────────────────
    if (!data.studyId || typeof data.studyId !== 'string') {
      return NextResponse.json({ error: 'Study selection is required' }, { status: 400 });
    }

    // ── Validate rubric version ───────────────────────────────────
    if (!data.rubricVersion || !RUBRIC_VERSIONS.includes(data.rubricVersion)) {
      data.rubricVersion = DEFAULT_RUBRIC_VERSION;
    }

    // ── Validate all 11 questions have valid rubric values ────────
    const rubric = getRubricByVersion(data.rubricVersion);
    const requiredQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];
    for (const q of requiredQuestions) {
      if (!data[q]) {
        return NextResponse.json({ error: `All 11 rubric questions must be answered (missing ${q.toUpperCase()})` }, { status: 400 });
      }
      // Validate against actual rubric options for this version
      const questionIndex = parseInt(q.replace('q', '')) - 1;
      const question = rubric[questionIndex];
      if (question) {
        const validValues = question.options.map(opt => opt.notionValue);
        if (!validValues.includes(data[q])) {
          return NextResponse.json({
            error: `Invalid value for ${q.toUpperCase()}. Must be a valid ${data.rubricVersion} rubric option.`,
          }, { status: 422 });
        }
      }
    }

    // ── Duplicate score prevention ────────────────────────────────
    // Check if this reviewer already scored this study
    const existingScores = await getScoresForStudy(data.studyId);
    const alreadyScored = existingScores.find(s => s.raterAlias === user.alias);
    if (alreadyScored) {
      return NextResponse.json({
        error: 'You have already scored this study. Each reviewer may submit one score per study.',
        existingScoreId: alreadyScored.id,
      }, { status: 409 });
    }

    data.raterAlias = user.alias;
    data.reviewerId = user.reviewerId;
    const page = await createScore(data);
    return NextResponse.json({ success: true, scoreId: page.id });
  } catch (error) {
    console.error('Create score error:', error);
    return NextResponse.json({ error: 'Failed to create score' }, { status: 500 });
  }
}

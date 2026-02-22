import { NextResponse } from 'next/server';
import { authenticateRequest, verifyAdminFromNotion } from '@/lib/auth';
import { getStudyById, createScore } from '@/lib/notion';
import { callLLM } from '@/lib/llm';
import { buildScoringPrompt, validateLLMScores } from '@/lib/llm-prompt';
import { ensureAIReviewerExists } from '@/lib/llm-reviewer';
import { getRubricByVersion, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';

export async function POST(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const isAdmin = await verifyAdminFromNotion(user);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { studyId, rubricVersion: requestedVersion } = await request.json();
    if (!studyId) {
      return NextResponse.json({ error: 'studyId is required' }, { status: 400 });
    }

    // Use requested version or default
    const version = requestedVersion || DEFAULT_RUBRIC_VERSION;
    const rubric = getRubricByVersion(version);

    // 1. Fetch study intake data
    let study;
    try {
      study = await getStudyById(studyId);
    } catch {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    if (!study || !study.citation) {
      return NextResponse.json({ error: 'Study not found or has no data' }, { status: 404 });
    }

    // 2. Ensure AI reviewer account exists
    const { reviewerId, alias } = await ensureAIReviewerExists();

    // 3. Build prompt from rubric + intake data (version-aware)
    const { systemPrompt, userPrompt } = buildScoringPrompt(study, version);

    // 4. Call LLM
    let llmResponse;
    try {
      llmResponse = await callLLM(systemPrompt, userPrompt);
    } catch (err) {
      console.error('LLM call failed:', err);
      return NextResponse.json(
        { error: `LLM error: ${err.message}` },
        { status: 502 }
      );
    }

    // 5. Validate scores (version-aware)
    const validation = validateLLMScores(llmResponse, version);
    if (!validation.valid) {
      console.error('LLM returned invalid scores:', validation.errors);
      return NextResponse.json(
        { error: 'LLM returned invalid scores', details: validation.errors },
        { status: 422 }
      );
    }

    // 6. Calculate total for the response
    let totalScore = 0;
    for (const q of rubric) {
      const notionVal = validation.scores[q.id];
      const opt = q.options.find(o => o.notionValue === notionVal);
      totalScore += opt ? opt.score : 0;
    }
    const qualityTier = totalScore >= 17 ? 'High' : totalScore >= 11 ? 'Moderate' : 'Low';

    // 7. Submit score via existing createScore flow
    const scoreData = {
      ...validation.scores,
      studyId,
      raterAlias: alias,
      reviewerId,
      notes: `[AI Auto-Review ${version}] ${validation.reasoning}`,
      rubricVersion: version,
      timeToComplete: 0,
    };

    const result = await createScore(scoreData);

    return NextResponse.json({
      success: true,
      scoreId: result.id,
      scores: validation.scores,
      totalScore,
      qualityTier,
      reasoning: validation.reasoning,
      rubricVersion: version,
    });
  } catch (err) {
    console.error('AI review error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to complete AI review' },
      { status: 500 }
    );
  }
}

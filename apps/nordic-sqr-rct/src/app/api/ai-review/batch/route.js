import { NextResponse } from 'next/server';
import { authenticateRequest, verifyAdminFromNotion } from '@/lib/auth';
import { getAllStudies, getAllScores, createScore } from '@/lib/notion';
import { callLLM } from '@/lib/llm';
import { buildScoringPrompt, validateLLMScores } from '@/lib/llm-prompt';
import { ensureAIReviewerExists } from '@/lib/llm-reviewer';
import { getRubricByVersion, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';

const AI_ALIAS = 'AI-Reviewer';
const TIMEOUT_MS = 50000; // 50s soft limit (Vercel 60s max)

export async function POST(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const isAdmin = await verifyAdminFromNotion(user);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const startTime = Date.now();

  try {
    // Check for version in request body (optional)
    let requestBody = {};
    try {
      requestBody = await request.json();
    } catch {
      // No body is fine — use defaults
    }
    const version = requestBody.rubricVersion || DEFAULT_RUBRIC_VERSION;
    const rubric = getRubricByVersion(version);

    // 1. Ensure AI reviewer exists
    const { reviewerId, alias } = await ensureAIReviewerExists();

    // 2. Fetch all studies and scores
    const [studies, scores] = await Promise.all([
      getAllStudies(),
      getAllScores(),
    ]);

    // 3. Find studies already scored by AI
    const aiScoredStudyIds = new Set();
    scores.forEach((score) => {
      if (score.raterAlias === AI_ALIAS && score.studyRelation?.[0]) {
        aiScoredStudyIds.add(score.studyRelation[0]);
      }
    });

    // 4. Filter to unscored studies
    const unscored = studies.filter((s) => !aiScoredStudyIds.has(s.id));
    const total = unscored.length;

    if (total === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: 0,
        remaining: 0,
        total: 0,
        message: 'All studies already have AI reviews.',
      });
    }

    // 5. Process sequentially with timeout awareness
    const processed = [];
    const failed = [];

    for (const study of unscored) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        break;
      }

      try {
        // Build prompt (version-aware)
        const { systemPrompt, userPrompt } = buildScoringPrompt(study, version);

        // Call LLM
        const llmResponse = await callLLM(systemPrompt, userPrompt);

        // Validate scores (version-aware)
        const validation = validateLLMScores(llmResponse, version);
        if (!validation.valid) {
          failed.push({
            studyId: study.id,
            citation: study.citation?.substring(0, 80),
            error: `Invalid scores: ${validation.errors.join(', ')}`,
          });
          continue;
        }

        // Calculate total score
        let totalScore = 0;
        for (const q of rubric) {
          const notionVal = validation.scores[q.id];
          const opt = q.options.find((o) => o.notionValue === notionVal);
          totalScore += opt ? opt.score : 0;
        }

        // Submit score
        const scoreData = {
          ...validation.scores,
          studyId: study.id,
          raterAlias: alias,
          reviewerId,
          notes: `[AI Auto-Review ${version}] ${validation.reasoning || ''}`,
          rubricVersion: version,
          timeToComplete: 0,
        };

        const result = await createScore(scoreData);

        processed.push({
          studyId: study.id,
          scoreId: result.id,
          citation: study.citation?.substring(0, 80),
          totalScore,
          qualityTier: totalScore >= 17 ? 'High' : totalScore >= 11 ? 'Moderate' : 'Low',
        });
      } catch (err) {
        failed.push({
          studyId: study.id,
          citation: study.citation?.substring(0, 80),
          error: err.message,
        });
      }
    }

    const remaining = total - processed.length - failed.length;

    return NextResponse.json({
      success: true,
      processed: processed.length,
      failed: failed.length,
      remaining,
      total,
      processedDetails: processed,
      failedDetails: failed,
      rubricVersion: version,
      elapsedMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('Batch AI review error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to run batch AI review' },
      { status: 500 }
    );
  }
}

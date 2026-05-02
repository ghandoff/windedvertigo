import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllScores, getAllStudies, getAllReviewers } from '@/lib/notion';
import {
  calculateCohensKappaPairs,
  calculateFleissKappas,
  calculateICC,
  buildArticleSummaries,
  buildReviewerStats,
  buildDistributions,
  calculateOverallAgreement,
  aggregateRoB2ForArticle,
} from '@/lib/statistics';

export async function GET(request) {
  // Wave 7.5 Batch C — analytics surface includes audit-shaped IRR data.
  const gate = await requireCapability(request, 'audit:read-logs', { route: '/api/analytics' });
  if (gate.error) return gate.error;

  try {
    // Check for version filter in query params
    const { searchParams } = new URL(request.url);
    const versionFilter = searchParams.get('version'); // 'V1', 'V2', or null (all)

    // Fetch all data from Notion in parallel
    const [allScores, studies, reviewers] = await Promise.all([
      getAllScores(),
      getAllStudies(),
      getAllReviewers(),
    ]);

    // Exclude test/calibration scores (notes containing [TEST] or [CALIBRATION])
    const nonTestScores = allScores.filter(s => {
      const notes = (s.notes || '').toUpperCase();
      return !notes.includes('[TEST]') && !notes.includes('[CALIBRATION]');
    });

    // Apply version filter if specified
    const scores = versionFilter
      ? nonTestScores.filter(s => s.rubricVersion === versionFilter)
      : nonTestScores;

    // Build version breakdown for summary
    const versionCounts = {};
    allScores.forEach(s => {
      const v = s.rubricVersion || 'Unknown';
      versionCounts[v] = (versionCounts[v] || 0) + 1;
    });

    // Group scores by study (using the first study relation ID)
    const articleScoresMap = {};
    scores.forEach(score => {
      const studyId = score.studyRelation?.[0];
      if (!studyId) return;
      if (!articleScoresMap[studyId]) articleScoresMap[studyId] = [];
      articleScoresMap[studyId].push(score);
    });

    // Calculate all analytics
    const cohensKappaPairs = calculateCohensKappaPairs(scores, articleScoresMap);
    const fleissKappas = calculateFleissKappas(articleScoresMap);
    const icc = calculateICC(articleScoresMap);
    const overallAgreement = calculateOverallAgreement(articleScoresMap);
    const articleSummaries = buildArticleSummaries(studies, articleScoresMap);

    // Attach RoB 2 domain mapping to each article so the /analytics
    // RoB 2 Mapping tab can render per-article domain judgments without
    // a second round-trip. Mean-and-round across raters — see
    // aggregateRoB2ForArticle docstring for rationale.
    for (const article of articleSummaries) {
      if (article.reviewerScores && article.reviewerScores.length > 0) {
        article.rob2 = aggregateRoB2ForArticle(article.reviewerScores);
      } else {
        article.rob2 = null;
      }
    }
    const reviewerStats = buildReviewerStats(scores, reviewers);
    const distributions = buildDistributions(scores);

    // Summary stats
    const totalArticles = studies.length;
    const totalScores = scores.length;
    const totalReviewers = reviewerStats.length;
    const articlesWithMultipleReviewers = Object.values(articleScoresMap)
      .filter(s => s.length >= 2).length;

    return NextResponse.json({
      summary: {
        totalArticles,
        totalScores,
        totalReviewers,
        articlesWithMultipleReviewers,
        overallAgreement,
        versionFilter: versionFilter || 'All',
        versionCounts,
      },
      irr: {
        cohensKappaPairs,
        fleissKappas,
        icc,
      },
      articles: articleSummaries,
      reviewers: reviewerStats,
      distributions,
    });
  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json(
      { error: 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}

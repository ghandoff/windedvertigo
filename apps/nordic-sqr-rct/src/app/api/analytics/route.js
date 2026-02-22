import { NextResponse } from 'next/server';
import { authenticateRequest, verifyAdminFromNotion } from '@/lib/auth';
import { getAllScores, getAllStudies, getAllReviewers } from '@/lib/notion';
import {
  calculateCohensKappaPairs,
  calculateFleissKappas,
  calculateICC,
  buildArticleSummaries,
  buildReviewerStats,
  buildDistributions,
  calculateOverallAgreement,
} from '@/lib/statistics';

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const isAdmin = await verifyAdminFromNotion(user);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

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

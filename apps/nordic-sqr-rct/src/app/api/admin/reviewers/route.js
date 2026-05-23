import { requireCapability } from '@/lib/auth/require-capability';
import { NextResponse } from 'next/server';
import { getAllReviewers } from '@/lib/sqr-reviewers';
import { getAllScores } from '@/lib/sqr-scores';

/**
 * GET /api/admin/reviewers
 *
 * Returns all reviewers enriched with their score statistics.
 * Part 10 migration: replaced direct Notion queries with lib functions
 * (which have shouldReadFromSqrPostgres() Postgres paths).
 */
export async function GET(request) {
  try {
    const gate = await requireCapability(request, 'users:edit-role', { route: '/api/admin/reviewers' });
    if (gate.error) return gate.error;

    // Fetch reviewers and scores in parallel — both lib functions use
    // Postgres when SQR_READ_FROM_POSTGRES=1 (already set in production).
    const [reviewers, allScores] = await Promise.all([
      getAllReviewers(),
      getAllScores(),
    ]);

    const enrichedReviewers = reviewers.map(reviewer => {
      const reviewerScores = allScores.filter(s => s.raterAlias === reviewer.alias);

      let avgScore = null;
      if (reviewerScores.length > 0) {
        const totalScore = reviewerScores.reduce((sum, score) => {
          const scores = [
            score.q1, score.q2, score.q3, score.q4, score.q5, score.q6,
            score.q7, score.q8, score.q9, score.q10, score.q11,
          ].filter(s => s !== null);
          return sum + scores.reduce((a, b) => a + b, 0);
        }, 0);
        avgScore = (totalScore / reviewerScores.length).toFixed(2);
      }

      const lastReviewDate = reviewerScores.length > 0
        ? (reviewerScores[0].timestamp || reviewerScores[0].createdTime || null)
        : null;

      return {
        ...reviewer,
        passwordHash: undefined, // never expose in API response
        reviewCount: reviewerScores.length,
        lastReviewDate,
        avgScore: avgScore ? parseFloat(avgScore) : null,
      };
    });

    return NextResponse.json({ reviewers: enrichedReviewers });
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

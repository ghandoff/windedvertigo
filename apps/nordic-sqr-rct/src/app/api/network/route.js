import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllReviewers, getAllScores } from '@/lib/notion';

export async function GET(request) {
  try {
    // Wave 7.5 Batch C — directory of reviewers requires `users:read`.
    const gate = await requireCapability(request, 'users:read', { route: '/api/network' });
    if (gate.error) return gate.error;

    const [reviewers, allScores] = await Promise.all([
      getAllReviewers(),
      getAllScores(),
    ]);

    // Build score counts per alias
    const scoreCounts = {};
    for (const score of allScores) {
      scoreCounts[score.raterAlias] = (scoreCounts[score.raterAlias] || 0) + 1;
    }

    // Return public profiles only (no email, password, admin status)
    const publicProfiles = reviewers
      .filter(r => r.consent)
      .map(r => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        alias: r.alias,
        affiliation: r.affiliation,
        affiliationType: r.affiliationType,
        discipline: r.discipline,
        domainExpertise: r.domainExpertise,
        yearsExperience: r.yearsExperience,
        profileImageUrl: r.profileImageUrl,
        reviewCount: scoreCounts[r.alias] || 0,
        memberSince: r.onboardingDate,
      }));

    return NextResponse.json({ reviewers: publicProfiles });
  } catch (error) {
    console.error('Network GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

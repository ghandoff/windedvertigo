import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAllStudies, getAllScores, createStudy } from '@/lib/notion';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const catalog = searchParams.get('catalog');

    if (catalog === 'true') {
      // Catalog mode: return unique articles grouped by DOI with reviewer counts
      const [allIntakes, allScores] = await Promise.all([
        getAllStudies(),
        getAllScores(),
      ]);

      // Build a map from intake page ID → DOI
      const intakeIdToDoi = {};
      allIntakes.forEach((intake) => {
        intakeIdToDoi[intake.id] = intake.doi;
      });

      // Count unique reviewer aliases per DOI from scores
      const reviewersByDoi = {};
      allScores.forEach((score) => {
        const studyIds = score.studyRelation || [];
        studyIds.forEach((studyId) => {
          const doi = intakeIdToDoi[studyId];
          if (doi) {
            if (!reviewersByDoi[doi]) reviewersByDoi[doi] = new Set();
            if (score.raterAlias) reviewersByDoi[doi].add(score.raterAlias);
          }
        });
      });

      // Group intakes by DOI, keep the earliest entry per DOI as the "original article"
      // Original articles are those NOT submitted by a specific reviewer alias
      // (or if all have aliases, use the first one found)
      const articlesByDoi = {};
      allIntakes.forEach((intake) => {
        if (!intake.doi) return; // skip entries without DOI
        if (!articlesByDoi[intake.doi]) {
          articlesByDoi[intake.doi] = intake;
        } else if (!intake.submittedByAlias && articlesByDoi[intake.doi].submittedByAlias) {
          // Prefer the entry without a reviewer alias (the "original" catalog entry)
          articlesByDoi[intake.doi] = intake;
        }
      });

      // Build the catalog response
      const articles = Object.entries(articlesByDoi).map(([doi, article]) => {
        const reviewerSet = reviewersByDoi[doi];
        const reviewerCount = reviewerSet ? reviewerSet.size : 0;
        return {
          ...article,
          reviewerCount,
          reviewers: reviewerSet ? [...reviewerSet] : [],
          needsReview: reviewerCount < 3,
          currentUserReviewed: reviewerSet ? reviewerSet.has(user.alias) : false,
        };
      });

      // Sort: articles needing review first, then by year descending
      articles.sort((a, b) => {
        if (a.needsReview && !b.needsReview) return -1;
        if (!a.needsReview && b.needsReview) return 1;
        return (b.year || 0) - (a.year || 0);
      });

      return NextResponse.json({ articles });
    }

    // Default: return all studies (original behavior)
    const studies = await getAllStudies();
    return NextResponse.json({ studies });
  } catch (error) {
    console.error('Get studies error:', error);
    return NextResponse.json({ error: 'Failed to fetch studies' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const data = await request.json();
    if (!data.citation?.trim()) return NextResponse.json({ error: 'Citation is required' }, { status: 400 });
    data.submittedByAlias = user.alias;
    const page = await createStudy(data);
    return NextResponse.json({ success: true, studyId: page.id });
  } catch (error) {
    console.error('Create study error:', error);
    return NextResponse.json({ error: 'Failed to create study' }, { status: 500 });
  }
}

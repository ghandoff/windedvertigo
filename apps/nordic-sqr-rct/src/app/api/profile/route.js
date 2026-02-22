import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getReviewerById, updateReviewerProfile, getScoresByReviewer } from '@/lib/notion';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const reviewer = await getReviewerById(user.reviewerId);
    const scores = await getScoresByReviewer(reviewer.alias);

    // Strip sensitive fields
    const { password, ...safeProfile } = reviewer;

    return NextResponse.json({
      profile: {
        ...safeProfile,
        reviewCount: scores.length,
        memberSince: reviewer.onboardingDate,
      },
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const allowedFields = ['firstName', 'lastName', 'affiliation', 'discipline', 'yearsExperience', 'profileImageUrl'];
    const updates = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await updateReviewerProfile(user.reviewerId, updates);

    // Re-fetch updated profile
    const reviewer = await getReviewerById(user.reviewerId);
    const { password, ...safeProfile } = reviewer;

    return NextResponse.json({ profile: safeProfile, success: true });
  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

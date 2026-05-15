import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getReviewerById, updateReviewerProfile } from '@/lib/sqr-reviewers';
import { getScoresByReviewer } from '@/lib/sqr-scores';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const reviewer = await getReviewerById(user.reviewerId);
    const scores = await getScoresByReviewer(reviewer.alias);

    // Strip sensitive fields
    const safeProfile = reviewer;

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

    // Validate profileImageUrl is from a trusted storage host if provided.
    // Accepts both the new R2 proxy path and legacy Vercel Blob URLs
    // (existing profiles keep working until the Vercel project is decommissioned).
    if (updates.profileImageUrl) {
      try {
        const u = new URL(updates.profileImageUrl);
        const isR2Path = u.pathname.startsWith('/api/r2/profiles/');
        const isVercelBlob = u.hostname.endsWith('.public.blob.vercel-storage.com');
        if (!isR2Path && !isVercelBlob) {
          return NextResponse.json({ error: 'Invalid image URL — must be uploaded via the profile form' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }

    await updateReviewerProfile(user.reviewerId, updates);

    // Re-fetch updated profile
    const reviewer = await getReviewerById(user.reviewerId);
    const safeProfile = reviewer;

    return NextResponse.json({ profile: safeProfile, success: true });
  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

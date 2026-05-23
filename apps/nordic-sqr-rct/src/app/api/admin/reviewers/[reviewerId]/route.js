import { requireCapability } from '@/lib/auth/require-capability';
import { updateReviewerRoles, updateReviewerProperties, getReviewerById } from '@/lib/sqr-reviewers';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/admin/reviewers/[reviewerId]
 *
 * Update reviewer isAdmin, status, and/or roles.
 *
 * Security constraint: only super-users may assign admin or super-user roles.
 *
 * Part 10 migration: replaced direct Notion write with `updateReviewerProperties()`
 * from sqr-reviewers lib (which has writePostgresFirst path).
 */
export async function PATCH(request, { params }) {
  try {
    const gate = await requireCapability(request, 'users:edit-role', { route: '/api/admin/reviewers/[reviewerId]' });
    if (gate.error) return gate.error;

    const body = await request.json();
    const { reviewerId } = await params;

    // Build update payload for isAdmin / status via lib function.
    const propertyUpdates = {};
    if (typeof body.isAdmin === 'boolean') propertyUpdates.isAdmin = body.isAdmin;
    if (body.status && typeof body.status === 'string') propertyUpdates.status = body.status;

    if (Object.keys(propertyUpdates).length > 0) {
      await updateReviewerProperties(reviewerId, propertyUpdates);
    }

    // Roles — delegate to the shared helper.
    // Assigning `admin` or `super-user` is privileged: only a super-user may grant.
    // A regular admin (users:edit-role) may only assign reviewer / researcher / ra.
    //
    // 2026-05-23 — Look up the caller's LIVE roles from Postgres rather
    // than trusting the JWT. A super-user whose token was minted before
    // they were promoted would otherwise be 403'd here despite their
    // Postgres row already containing `super-user`. The token will catch
    // up on its next refresh, but the platform shouldn't make them wait.
    if (Array.isArray(body.roles)) {
      const PRIVILEGED_ROLES = ['admin', 'super-user'];
      const requestsPrivileged = body.roles.some(r => PRIVILEGED_ROLES.includes(r));
      if (requestsPrivileged) {
        let callerIsSuperUser = false;
        if (gate.user?.reviewerId) {
          try {
            const liveReviewer = await getReviewerById(gate.user.reviewerId);
            const liveRoles = Array.isArray(liveReviewer?.roles) ? liveReviewer.roles : [];
            callerIsSuperUser = liveRoles.includes('super-user');
          } catch {
            // Fall back to JWT if Postgres lookup fails — preserves the gate.
            callerIsSuperUser = (gate.user?.roles ?? []).includes('super-user');
          }
        }
        if (!callerIsSuperUser) {
          return NextResponse.json(
            { error: 'Only super-users may assign admin or super-user roles.' },
            { status: 403 },
          );
        }
      }
      await updateReviewerRoles(reviewerId, body.roles);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reviewer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

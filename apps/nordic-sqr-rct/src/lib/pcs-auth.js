/**
 * PCS auth middleware — gate PCS portal routes by role.
 *
 * Users with 'pcs' or 'admin' role can read and write.
 * Users with 'pcs-readonly' role can only read.
 * The role is checked from the JWT payload (set at login).
 * Write operations additionally re-verify against Notion.
 */

import { authenticateRequest, verifyAdminFromNotion } from './auth.js';
import { NextResponse } from 'next/server';

function hasPcsAccess(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.includes('pcs') || roles.includes('pcs-readonly') || roles.includes('admin');
}

function hasPcsWriteAccess(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.includes('pcs') || roles.includes('admin');
}

/**
 * Authenticate a PCS read request. Trusts JWT roles claim.
 * Allows pcs, pcs-readonly, and admin roles.
 */
export async function authenticatePcsRead(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  // Backwards-compatible: if no roles in JWT, fall back to isAdmin check
  const roles = user.roles || (user.isAdmin ? ['sqr-rct', 'pcs', 'admin'] : ['sqr-rct']);
  if (!hasPcsAccess(roles)) {
    return { error: NextResponse.json({ error: 'PCS access required. Contact your administrator.' }, { status: 403 }) };
  }
  return { user: { ...user, roles } };
}

/**
 * Authenticate a PCS write request. Re-verifies against Notion for safety.
 * Only allows pcs and admin roles (not pcs-readonly).
 */
export async function authenticatePcsWrite(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  const roles = user.roles || (user.isAdmin ? ['sqr-rct', 'pcs', 'admin'] : ['sqr-rct']);
  if (!hasPcsWriteAccess(roles)) {
    return { error: NextResponse.json({ error: 'PCS write access required. Read-only users cannot modify data.' }, { status: 403 }) };
  }
  // Re-verify roles from Notion for write operations
  if (!user.reviewerId) {
    return { error: NextResponse.json({ error: 'Invalid session' }, { status: 403 }) };
  }
  try {
    const { getReviewerById } = await import('@/lib/notion');
    const reviewer = await getReviewerById(user.reviewerId);
    if (!reviewer) {
      return { error: NextResponse.json({ error: 'User not found' }, { status: 403 }) };
    }
    if (!hasPcsWriteAccess(reviewer.roles)) {
      return { error: NextResponse.json({ error: 'PCS write access revoked' }, { status: 403 }) };
    }
    // Return live Notion roles, not stale JWT roles
    return { user: { ...user, roles: reviewer.roles } };
  } catch {
    return { error: NextResponse.json({ error: 'Authorization check failed' }, { status: 500 }) };
  }
}

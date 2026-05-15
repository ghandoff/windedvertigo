import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

/**
 * Derive the workspace variant from the authenticated user's roles.
 * 'research' = PCS surface (has pcs/pcs-readonly/admin role)
 * 'reviewer' = SQR-RCT surface (all others)
 */
export function getWorkspaceVariant(user) {
  if (!user) return 'reviewer';
  return hasAnyRole(user, ROLE_SETS.PCS_ANY) ? 'research' : 'reviewer';
}

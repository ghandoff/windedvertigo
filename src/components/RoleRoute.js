'use client';

import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route guard that checks user has at least one of the required roles.
 * Falls back to isAdmin for backwards compatibility with pre-roles JWTs.
 *
 * Usage: <RoleRoute requires={['pcs', 'admin']}>{children}</RoleRoute>
 */
export default function RoleRoute({ requires, children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Derive roles: use explicit roles from JWT, or fall back to Admin checkbox
  const userRoles = user.roles?.length > 0
    ? user.roles
    : user.isAdmin
      ? ['sqr-rct', 'pcs', 'admin']
      : ['sqr-rct'];

  const hasAccess = requires.some(r => userRoles.includes(r));

  if (!hasAccess) {
    // Determine where to send them based on what they CAN access
    const fallbackHref = userRoles.includes('sqr-rct') ? '/dashboard'
      : userRoles.includes('pcs') || userRoles.includes('pcs-readonly') ? '/pcs'
      : '/';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <svg className="w-20 h-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Required</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this section. Contact your administrator to request access.
          </p>
          <Link href={fallbackHref} className="btn-primary inline-block">
            Go to {fallbackHref === '/pcs' ? 'PCS Portal' : 'Dashboard'}
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

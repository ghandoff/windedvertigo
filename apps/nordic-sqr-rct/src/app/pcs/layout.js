'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import { ToastProvider } from '@/components/Toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleRoute from '@/components/RoleRoute';
import PcsNav from '@/components/pcs/PcsNav';
import Footer from '@/components/Footer';
import FeedbackButton from '@/components/FeedbackButton';
import RoleAwareSidebar from '@/components/sidebar/RoleAwareSidebar';
import { deriveSidebarRole } from '@/components/sidebar/sidebar-items';

/**
 * Inner shell that consumes `useAuth()` to derive the sidebar role at runtime.
 * Wave 7.4 live adoption (2026-05-03): the role-aware sidebar graduates from
 * the `/admin/sidebar-preview` preview into the actual PCS workspace layout.
 *
 * The Wave 7.x chained track (7.2.0 WorkspaceShell + 7.2.1 route relocation)
 * is intentionally NOT a prerequisite for this — the user's stated goal was
 * "make the per-profile preview live", not the upstream architectural cleanup.
 * When 7.2.0 lands, this shell collapses into the global `WorkspaceShell`
 * without changing any sidebar behavior.
 */
function PcsWorkspaceShell({ children }) {
  const { user } = useAuth();
  const sidebarRole = deriveSidebarRole(user);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PcsNav />
      <div className="flex-1 flex">
        {sidebarRole ? (
          <RoleAwareSidebar role={sidebarRole} user={user} />
        ) : null}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
      <Footer />
      {/* Wave 6.1 — floating feedback button, persists across route changes.
          Renders only when authenticated (FeedbackButton guards internally). */}
      <FeedbackButton />
    </div>
  );
}

export default function PcsLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProtectedRoute>
          <RoleRoute requires={['pcs', 'pcs-readonly', 'admin']}>
            <PcsWorkspaceShell>{children}</PcsWorkspaceShell>
          </RoleRoute>
        </ProtectedRoute>
      </ToastProvider>
    </AuthProvider>
  );
}

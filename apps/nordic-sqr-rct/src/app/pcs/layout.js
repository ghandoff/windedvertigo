'use client';

import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { ToastProvider } from '@/components/Toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleRoute from '@/components/RoleRoute';
import WorkspaceShell from '@/components/WorkspaceShell';
import Footer from '@/components/Footer';
import FeedbackButton from '@/components/FeedbackButton';
import RoleAwareSidebar from '@/components/sidebar/RoleAwareSidebar';
import { deriveSidebarRole, getLayoutForRole } from '@/components/sidebar/sidebar-items';

const ROLE_OVERRIDE_STORAGE_KEY = 'sidebarRoleOverride';

/**
 * Inner shell that consumes `useAuth()` to derive the sidebar role at runtime.
 *
 * Wave 7.4 live adoption (2026-05-03): the role-aware sidebar graduates from
 * the `/admin/sidebar-preview` preview into the actual PCS workspace layout.
 *
 * 2026-05-03 UX pass: super-user / admin can switch the rendered sidebar role
 * in place via the role-switcher in the sidebar footer. The choice persists
 * to localStorage (`sidebarRoleOverride`) so the same view sticks across
 * navigations and reloads. Defense-in-depth: this is a *view* picker only —
 * middleware + capability gates stay authoritative for permissions.
 */
function PcsWorkspaceShell({ children }) {
  const { user } = useAuth();
  const baseRole = deriveSidebarRole(user);
  const baseLayout = baseRole ? getLayoutForRole(baseRole) : null;
  const canOverride = !!baseLayout?.showRoleSwitcher;

  const [overrideRole, setOverrideRole] = useState(null);

  // Hydrate the persisted override after mount.
  useEffect(() => {
    if (!canOverride) return;
    try {
      const stored = window.localStorage.getItem(ROLE_OVERRIDE_STORAGE_KEY);
      if (stored && stored !== baseRole) setOverrideRole(stored);
    } catch {
      /* localStorage may throw in private mode */
    }
  }, [canOverride, baseRole]);

  const onRoleChange = canOverride
    ? (next) => {
        setOverrideRole(next === baseRole ? null : next);
        try {
          if (next === baseRole) window.localStorage.removeItem(ROLE_OVERRIDE_STORAGE_KEY);
          else window.localStorage.setItem(ROLE_OVERRIDE_STORAGE_KEY, next);
        } catch { /* ignore */ }
      }
    : null;

  const sidebarRole = canOverride && overrideRole ? overrideRole : baseRole;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <WorkspaceShell variant="research" />
      <div className="flex-1 flex">
        {sidebarRole ? (
          <RoleAwareSidebar role={sidebarRole} user={user} onRoleChange={onRoleChange} />
        ) : null}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
      <Footer />
      {/* Wave 6.1 — floating feedback button, persists across route changes. */}
      <FeedbackButton />
    </div>
  );
}

export default function PcsLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProtectedRoute>
          <RoleRoute requires={['pcs', 'pcs-readonly', 'admin', 'super-user', 'researcher', 'ra']}>
            <PcsWorkspaceShell>{children}</PcsWorkspaceShell>
          </RoleRoute>
        </ProtectedRoute>
      </ToastProvider>
    </AuthProvider>
  );
}

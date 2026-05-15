'use client';

/**
 * Wave 7.4 preview — role-aware Option A sidebar scaffold.
 *
 * This is a **preview-only** route. It is NOT the real sidebar. The real
 * sidebar lands in Wave 7.4 proper, which depends on Wave 7.3.0 (email
 * migration), 7.2.0 (WorkspaceShell refactor), and 7.2.1 (route moves).
 * See `docs/plans/wave-7-master-architecture.md` §4.
 *
 * Purpose: let Garrett share this URL with Gina / Lauren / Sharon / the RAs
 * so they can visually validate the shape of "their" sidebar before the
 * underlying infrastructure lands.
 *
 * Gating: wrapped in `AdminRoute` + an explicit `schema:edit` capability
 * check. In today's capability matrix only `super-user` holds `schema:edit`,
 * so the route effectively restricts to Garrett until Wave 7.1.4 promotes
 * additional super-users.
 */

import { useState } from 'react';
import Link from 'next/link';
import WorkspaceShell from '@/components/WorkspaceShell';
import Footer from '@/components/Footer';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';
import RoleAwareSidebar from '@/components/sidebar/RoleAwareSidebar';
import RoleSwitcher from '@/components/sidebar/role-switcher';
import { ROLE_LABEL } from '@/components/sidebar/sidebar-items';

function CapabilityGate({ children }) {
  const { user } = useAuth();
  if (!can(user, 'schema:edit')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Super-user preview
          </h1>
          <p className="text-gray-600 mb-6">
            The Wave 7.4 sidebar preview is restricted to super-users while
            the underlying infrastructure (email migration, WorkspaceShell,
            route moves) is still in flight.
          </p>
          <Link href="/admin" className="btn-primary inline-block">
            Return to Admin
          </Link>
        </div>
      </div>
    );
  }
  return children;
}

function PreviewContent() {
  const { user } = useAuth();
  const [role, setRole] = useState('researcher');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <WorkspaceShell variant="reviewer" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6">
        {/* Breadcrumb + heading */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/admin" className="hover:text-pacific transition">Admin</Link>
            <span>/</span>
            <span className="text-gray-700">Sidebar Preview</span>
          </div>
          <h1 className="text-3xl font-bold text-pacific">
            Role-aware sidebar — preview
          </h1>
          <p className="text-gray-600 mt-2 max-w-3xl">
            Wave 7.4. Non-functional preview so the team can sign off on the
            shape of each role&apos;s sidebar before the underlying plumbing
            lands.
          </p>
        </div>

        {/* Live-status banner */}
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 mt-0.5 shrink-0 text-green-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="text-sm text-green-900">
              <p className="font-semibold">Live — graduated 2026-05-03.</p>
              <p className="mt-1">
                The role-aware sidebar is now mounted in the live PCS workspace
                layout (<code className="text-xs bg-green-100 px-1 py-0.5 rounded">src/app/pcs/layout.js</code>),
                rendering for every authenticated PCS user based on their
                effective role. This page remains as a super-user dev tool to
                preview every role&apos;s layout side-by-side without logging
                in as each one.
              </p>
            </div>
          </div>
        </div>

        {/* Role picker */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px]">
              <RoleSwitcher
                value={role}
                onChange={setRole}
                label="Preview sidebar for role"
              />
            </div>
            <p className="text-sm text-gray-500 flex-1">
              Switch through all five roles to verify the items, groups, and
              ordering. The sidebar below re-renders from
              <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                src/components/sidebar/sidebar-items.js
              </code>
              — that file is the single source of truth.
            </p>
          </div>
        </div>

        {/* Preview canvas */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="flex min-h-[560px]">
            {/* The sidebar itself */}
            <RoleAwareSidebar
              role={role}
              user={user}
              onRoleChange={role === 'super-user' ? setRole : null}
            />

            {/* Fake-content panel */}
            <div className="flex-1 bg-gray-50 p-8">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-pacific-500" />
                  Viewing as {ROLE_LABEL[role]}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  This is where the page content would be.
                </h2>
                <p className="text-gray-600 mb-4">
                  In the real Wave 7.4 layout, the sidebar on the left is
                  rendered by the shared <code className="text-sm">WorkspaceShell</code>
                  and the page content fills this area. Only the left rail is
                  preview-accurate here — the rest is placeholder.
                </p>
                <p className="text-gray-600 mb-4">
                  What to check on the sidebar:
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-1.5 text-sm">
                  <li>Items + order match the sketch for this role.</li>
                  <li>Group headers collapse/expand when clicked.</li>
                  <li>The active-item highlight follows <code className="text-xs">usePathname()</code>.</li>
                  <li>Badge counts render where specified (illustrative only).</li>
                  <li>Super-user variant shows Governance + role switcher.</li>
                  <li>Reviewer variant has no groups and shows the &quot;Reviewer&quot; sub-line.</li>
                </ul>

                <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Source
                  </p>
                  <p className="text-sm text-gray-700">
                    Role sketches:
                    <code className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                      docs/plans/wave-7-master-architecture.md §4
                    </code>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Counts shown are live data from your Notion workspace
                    (cached 30s).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SidebarPreviewPage() {
  return (
    <AuthProvider>
      <AdminRoute>
        <CapabilityGate>
          <PreviewContent />
        </CapabilityGate>
      </AdminRoute>
    </AuthProvider>
  );
}

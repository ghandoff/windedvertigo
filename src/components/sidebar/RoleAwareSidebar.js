'use client';

/**
 * Wave 7.4 preview — role-aware Option A sidebar.
 *
 * Renders the per-role layout from `sidebar-items.js`. Takes a `role`
 * prop directly (so the preview's role switcher can drive it) and
 * optionally a `user` prop (so the footer chip shows the logged-in
 * viewer's name).
 *
 * Shape mirrors the sketches in `docs/plans/wave-7-master-architecture.md`
 * §4.1–§4.5:
 *   - Brand block at top ("Nordic Research", plus "Reviewer" sub-line on
 *     the reviewer variant only).
 *   - Optional pinned top item (Command Center / Meta Dashboard).
 *   - Flat list (reviewer only) OR grouped sections (all other roles).
 *   - Footer: profile + logout link, plus role switcher for super-user.
 *
 * Explicit non-goal: this does NOT replace the existing Navbar. It is a
 * preview-only component rendered on the `/admin/sidebar-preview` page.
 *
 * When Wave 7.4 proper lands (post-7.2.0/7.2.1/7.3.0), this file becomes
 * the `<WorkspaceShell>` sidebar slot and reads `user.roles` directly
 * rather than taking a `role` prop. The data in `sidebar-items.js` does
 * not change shape; only the prop interface here.
 */

import Link from 'next/link';
import SidebarGroup from './SidebarGroup';
import SidebarItem from './SidebarItem';
import RoleSwitcher from './role-switcher';
import { getLayoutForRole, ROLE_LABEL } from './sidebar-items';
import useSidebarCounts from './useSidebarCounts';

export default function RoleAwareSidebar({
  role = 'researcher',
  user = null,
  onRoleChange = null,  // super-user role-switcher callback (preview only)
}) {
  const layout = getLayoutForRole(role);
  const { counts, loading: countsLoading } = useSidebarCounts();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Brand block */}
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="text-sm font-bold text-pacific">Nordic Research</div>
        {layout.brandSubline ? (
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            — {layout.brandSubline}
          </div>
        ) : null}
      </div>

      {/* Body */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {/* Pinned top (Command Center / Meta Dashboard) */}
        {layout.pinnedTop ? (
          <div className="mb-2">
            <SidebarItem
              item={layout.pinnedTop}
              exact
              counts={counts}
              countsLoading={countsLoading}
            />
          </div>
        ) : null}

        {/* Flat list (reviewer) */}
        {layout.flat
          ? layout.flat.map((item) => (
              <SidebarItem
                key={item.key}
                item={item}
                counts={counts}
                countsLoading={countsLoading}
              />
            ))
          : null}

        {/* Grouped (everyone else) */}
        {layout.groups
          ? layout.groups.map((group) => (
              <SidebarGroup
                key={group.key}
                group={group}
                counts={counts}
                countsLoading={countsLoading}
              />
            ))
          : null}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-3 space-y-2">
        {/* Role-switcher (super-user only) */}
        {layout.showRoleSwitcher && onRoleChange ? (
          <div className="rounded-md bg-gold-50 border border-gold-200 p-2">
            <RoleSwitcher value={role} onChange={onRoleChange} label="Currently viewing" />
          </div>
        ) : null}

        {/* Profile */}
        <Link
          href="/profile"
          className="block rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          {user?.alias || user?.firstName
            ? `Profile — ${user.firstName || user.alias}`
            : 'Profile'}
        </Link>

        {/* Role chip */}
        <div className="text-[10px] text-gray-400">
          Role: <span className="font-semibold text-gray-600">{ROLE_LABEL[role]}</span>
        </div>
      </div>
    </aside>
  );
}

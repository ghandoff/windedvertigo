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
 * Explicit non-goal: this does NOT replace the existing Navbar. The Navbar
 * remains for top-level wayfinding; the sidebar is the per-role left rail.
 *
 * Wave 7.4 live adoption (2026-05-03): this component is now mounted in the
 * `/pcs/*` workspace layout (`src/app/pcs/layout.js`) via `deriveSidebarRole`,
 * which picks the highest-precedence role from `user.roles[]`. The
 * `/admin/sidebar-preview` page remains as a dev tool for super-users to
 * preview each role's layout in isolation. The 7.2.0 WorkspaceShell refactor
 * will eventually subsume this mount; until then both coexist.
 */

import Link from 'next/link';
import SidebarGroup from './SidebarGroup';
import SidebarItem from './SidebarItem';
import RoleSwitcher from './role-switcher';
import PremiumCard from './PremiumCard';
import {
  getLayoutForRole,
  ROLE_LABEL,
  PREMIUM_GROUP,
  shouldShowPremiumGroup,
  isPremiumUnlocked,
} from './sidebar-items';
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

        {/* 2026-05-03 — the Premium tile cards moved out of the sidebar
            (UX feedback: claustrophobic when collapsed inline). The Premium
            previews still live at /admin/premium-preview/[slug]; super-users
            and admins land there via the footer link below. */}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-2">
        {/* Role-switcher (super-user / admin — preview other roles in place).
            2026-05-04 fix: presence of `onRoleChange` is the authoritative
            signal for "this user can switch views" — it's set in pcs/layout.js
            based on the user's BASE role (super-user / admin), not the
            currently-rendered role. Earlier we also gated on
            `layout.showRoleSwitcher`, but `layout` is for the rendered role
            (e.g., researcher when super-user is viewing as researcher) and
            that flag is only set on the super-user layout — so the dropdown
            would disappear after the first switch and the user couldn't
            switch back. Trusting `onRoleChange` alone fixes that. */}
        {onRoleChange ? (
          <div className="rounded-md bg-gold-50 border border-gold-200 p-2">
            <RoleSwitcher value={role} onChange={onRoleChange} label="Viewing as" />
          </div>
        ) : null}

        {/* Premium preview link (super-user / admin only) */}
        {shouldShowPremiumGroup(role) && PREMIUM_GROUP.items[0] ? (
          <Link
            href={PREMIUM_GROUP.items[0].href || '/admin/premium-preview/llm-cost-optimizer'}
            className="block rounded-md px-2 py-1.5 text-xs font-medium text-gold-800 hover:bg-gold-50"
          >
            ✨ Advanced features →
          </Link>
        ) : null}

        {/* Profile */}
        <Link
          href="/reviews/profile"
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

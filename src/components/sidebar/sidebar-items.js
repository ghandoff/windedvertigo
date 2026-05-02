/**
 * Wave 7.4 preview — role-aware Option A sidebar data.
 *
 * This module is **data only** — no JSX. The `RoleAwareSidebar` component
 * reads from this map to render the per-role layouts from
 * `docs/plans/wave-7-master-architecture.md` §4.1–§4.5.
 *
 * Each role entry is:
 *   {
 *     brandSubline?: string,      // optional text under "Nordic Research" (reviewer only)
 *     pinnedTop?: NavItem,        // item rendered above all groups (Command Ctr, Meta dash, etc.)
 *     flat?: NavItem[],           // flat list when there are no groups (Reviewer)
 *     groups?: Group[],           // collapsible groups (every other role)
 *     showGovernance?: boolean,   // super-user only
 *     showRoleSwitcher?: boolean, // super-user only
 *   }
 *
 * NavItem = { key, label, href, badgeKey?, readOnlyHint? }
 * Group   = { key, label, defaultOpen, items: NavItem[] }
 *
 * `badgeKey` is a dotted path into the live-counts payload returned by
 * `/api/sidebar/counts` (see `useSidebarCounts.js`). The renderer
 * (`SidebarItem`) looks up `counts.<badgeKey>` and shows it as a badge,
 * suppressing the badge entirely when the value is 0 / null. While the
 * counts are loading the renderer shows `…` instead of a number.
 *
 * IMPORTANT: these routes are **notional** — Wave 7.2.1 moves PCS into
 * `/research/pcs/*` and reviewer pages into `/reviews/*`. For the preview
 * we point at the best approximation of today's routes so links don't 404,
 * but they're placeholder targets; post-7.2.1 the hrefs will be rewritten
 * centrally here without touching any component.
 */

export const ROLES = Object.freeze([
  'reviewer',
  'researcher',
  'ra',
  'admin',
  'super-user',
]);

export const ROLE_LABEL = Object.freeze({
  'reviewer':   'Reviewer',
  'researcher': 'Researcher',
  'ra':         'Research Assistant (RA)',
  'admin':      'Admin',
  'super-user': 'Super-user',
});

/**
 * Per-role sidebar layout. Matches §4 sketches exactly.
 *
 * Badge values come from `/api/sidebar/counts` via `useSidebarCounts`.
 * Each item with a badge declares a `badgeKey` (a dotted path into the
 * counts payload) rather than a hardcoded number, so this file stays
 * declarative.
 */
export const SIDEBAR_LAYOUTS = Object.freeze({
  // §4.1 — Reviewer: flat list, no groups, explicit "Reviewer" sub-line.
  'reviewer': {
    brandSubline: 'Reviewer',
    flat: [
      { key: 'my-reviews', label: 'My Reviews', href: '/reviews' },
      { key: 'completed', label: 'Completed', href: '/reviews?tab=completed' },
      { key: 'profile',   label: 'Profile',   href: '/profile' },
    ],
  },

  // §4.2 — Researcher: Command Center + Authoring + Review. No Operations.
  'researcher': {
    pinnedTop: { key: 'command-center', label: 'Command Center', href: '/pcs' },
    groups: [
      {
        key: 'authoring',
        label: 'Authoring',
        defaultOpen: true,
        items: [
          { key: 'documents',   label: 'Documents',   href: '/pcs/documents' },
          { key: 'claims',      label: 'Claims',      href: '/pcs/claims' },
          { key: 'evidence',    label: 'Evidence',    href: '/pcs/evidence' },
          { key: 'ingredients', label: 'Ingredients', href: '/pcs/data/ingredients' },
        ],
      },
      {
        key: 'review',
        label: 'Review',
        defaultOpen: true,
        items: [
          { key: 'requests', label: 'Requests', href: '/pcs/requests', badgeKey: 'requests.withResearch' },
        ],
      },
    ],
  },

  // §4.3 — RA: Review-heavy, Authoring read-only, Operations.Export only.
  'ra': {
    pinnedTop: { key: 'command-center', label: 'Command Center', href: '/pcs' },
    groups: [
      {
        key: 'review',
        label: 'Review',
        defaultOpen: true,
        items: [
          { key: 'requests', label: 'Requests', href: '/pcs/requests', badgeKey: 'requests.withRA' },
          { key: 'drift',    label: 'Drift',    href: '/pcs/labels/drift', badgeKey: 'drift.openCount' },
        ],
      },
      {
        key: 'authoring',
        label: 'Authoring',
        defaultOpen: false,
        readOnlyHint: true,
        items: [
          { key: 'documents', label: 'Documents', href: '/pcs/documents' },
          { key: 'claims',    label: 'Claims',    href: '/pcs/claims' },
          { key: 'evidence',  label: 'Evidence',  href: '/pcs/evidence' },
        ],
      },
      {
        key: 'operations',
        label: 'Operations',
        defaultOpen: true,
        items: [
          { key: 'export', label: 'Export', href: '/pcs/export' },
        ],
      },
    ],
  },

  // §4.4 — Admin: Researcher + full Operations (Imports, Label Imports, Export).
  'admin': {
    pinnedTop: { key: 'command-center', label: 'Command Center', href: '/pcs' },
    groups: [
      {
        key: 'authoring',
        label: 'Authoring',
        defaultOpen: true,
        items: [
          { key: 'documents',   label: 'Documents',   href: '/pcs/documents' },
          { key: 'claims',      label: 'Claims',      href: '/pcs/claims' },
          { key: 'evidence',    label: 'Evidence',    href: '/pcs/evidence' },
          { key: 'ingredients', label: 'Ingredients', href: '/pcs/data/ingredients' },
        ],
      },
      {
        key: 'review',
        label: 'Review',
        defaultOpen: true,
        items: [
          { key: 'requests', label: 'Requests', href: '/pcs/requests', badgeKey: 'requests.total' },
          { key: 'drift',    label: 'Drift',    href: '/pcs/labels/drift', badgeKey: 'drift.openCount' },
        ],
      },
      {
        key: 'operations',
        label: 'Operations',
        defaultOpen: true,
        items: [
          { key: 'imports',       label: 'Imports',       href: '/pcs/imports', badgeKey: 'imports.active' },
          { key: 'label-imports', label: 'Label Imports', href: '/pcs/labels/imports', badgeKey: 'labelImports.active' },
          { key: 'export',        label: 'Export',        href: '/pcs/export' },
        ],
      },
    ],
  },

  // §4.5 — Super-user: Meta dashboard + everything + Governance + role switcher.
  'super-user': {
    pinnedTop: { key: 'meta-dashboard', label: 'Meta Dashboard', href: '/admin' },
    showGovernance: true,
    showRoleSwitcher: true,
    groups: [
      {
        key: 'authoring',
        label: 'Authoring',
        defaultOpen: false,
        items: [
          { key: 'documents',   label: 'Documents',   href: '/pcs/documents' },
          { key: 'claims',      label: 'Claims',      href: '/pcs/claims' },
          { key: 'evidence',    label: 'Evidence',    href: '/pcs/evidence' },
          { key: 'ingredients', label: 'Ingredients', href: '/pcs/data/ingredients' },
        ],
      },
      {
        key: 'review',
        label: 'Review',
        defaultOpen: true,
        items: [
          { key: 'requests',       label: 'Requests',          href: '/pcs/requests', badgeKey: 'requests.total' },
          { key: 'drift',          label: 'Drift',             href: '/pcs/labels/drift', badgeKey: 'drift.openCount' },
          { key: 'reviewer-activity', label: 'Reviewer Activity', href: '/admin/reviewers' },
        ],
      },
      {
        key: 'operations',
        label: 'Operations',
        defaultOpen: true,
        items: [
          { key: 'imports',       label: 'Imports',       href: '/pcs/imports', badgeKey: 'imports.active' },
          { key: 'label-imports', label: 'Label Imports', href: '/pcs/labels/imports', badgeKey: 'labelImports.active' },
          { key: 'export',        label: 'Export',        href: '/pcs/export' },
        ],
      },
      {
        key: 'governance',
        label: 'Governance',
        defaultOpen: true,
        items: [
          { key: 'audit-log', label: 'Audit Log',  href: '/admin/audit' },
          { key: 'users',     label: 'Users',      href: '/admin/reviewers' },
          { key: 'backups',   label: 'Backups',    href: '/admin/backups' },
          { key: 'schema',    label: 'Schema',     href: '/admin/schema' },
        ],
      },
    ],
  },
});

export function getLayoutForRole(role) {
  return SIDEBAR_LAYOUTS[role] || SIDEBAR_LAYOUTS['reviewer'];
}

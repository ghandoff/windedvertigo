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

/**
 * Wave 8 Phase B (Budget B teaser) — "Advanced (Premium)" section.
 *
 * Shown to every role that sees a sidebar. For non-`super-user` viewers each
 * item renders as a locked card with a "Premium retainer tier" badge and an
 * explanatory tooltip. Super-users see the same items unlocked, each linking
 * to a placeholder preview route under /admin/premium-preview/[slug].
 *
 * The four cards are aligned with the Winded Vertigo R&D retainer roadmap
 * (Budget B in the contract reset). Order matters — show the highest-FOMO
 * item (LLM cost) first.
 */
export const PREMIUM_GROUP = Object.freeze({
  key: 'advanced-premium',
  label: 'Advanced (Premium)',
  defaultOpen: true,
  items: Object.freeze([
    {
      key: 'llm-cost-optimizer',
      label: 'LLM Cost Optimizer',
      href: '/admin/premium-preview/llm-cost-optimizer',
      premium: true,
      description:
        'Replace Claude calls with deterministic parsers + OSS models. Ships ~80% LLM cost reduction.',
    },
    {
      key: 'notion-supabase-backfill',
      label: 'Notion → Supabase Backfill',
      href: '/admin/premium-preview/notion-supabase-backfill',
      premium: true,
      description:
        'Migrate the PCS corpus to Postgres for 5× faster reads + RLS.',
    },
    {
      key: 'realtime-multi-user-editing',
      label: 'Real-time Multi-User Editing',
      href: '/admin/premium-preview/realtime-multi-user-editing',
      premium: true,
      description:
        'Sharon and Lauren editing the same PCS simultaneously, conflict-free.',
    },
    {
      key: 'compliance-pack',
      label: 'HIPAA / SOC 2 Compliance Pack',
      href: '/admin/premium-preview/compliance-pack',
      premium: true,
      description:
        'Audit-ready posture for regulated-data partners.',
    },
  ]),
});

/**
 * True when the role should see the Advanced (Premium) section in their
 * sidebar. Reviewer is excluded (their flat layout is intentionally
 * minimal); everyone else sees it.
 */
export function shouldShowPremiumGroup(role) {
  return role !== 'reviewer';
}

/**
 * True when the role unlocks Premium items (renders them as live links
 * rather than locked cards). Super-user only.
 */
export function isPremiumUnlocked(role) {
  return role === 'super-user';
}

/**
 * Wave 7.4 live adoption — derive the single sidebar role to render from
 * a user's full `user.roles[]` array.
 *
 * The JWT may carry multiple role strings (e.g. `['admin', 'pcs']`). The
 * sidebar renders one layout, so we pick the highest-precedence role:
 *
 *   super-user > admin > ra > researcher > reviewer
 *
 * Legacy role aliases (`pcs`, `pcs-readonly`, `sqr-rct`) map to their
 * Wave 7.1 successors so pre-migration JWTs still get a sensible sidebar.
 *
 * Returns `null` when the user is unauthenticated or has no recognizable
 * role; the caller should not render the sidebar in that case.
 */
export function deriveSidebarRole(user) {
  if (!user) return null;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  // Legacy `isAdmin` boolean fallback (pre-roles-array JWTs).
  const effective = roles.length > 0
    ? roles
    : (user.isAdmin ? ['admin'] : []);
  if (effective.length === 0) return null;

  // Precedence walk — first hit wins.
  if (effective.includes('super-user')) return 'super-user';
  if (effective.includes('admin'))      return 'admin';
  if (effective.includes('ra'))         return 'ra';
  if (effective.includes('researcher')) return 'researcher';
  if (effective.includes('pcs'))        return 'researcher';   // legacy → researcher
  if (effective.includes('pcs-readonly')) return 'researcher'; // legacy → researcher
  if (effective.includes('reviewer'))   return 'reviewer';
  if (effective.includes('sqr-rct'))    return 'reviewer';     // legacy → reviewer
  return null;
}

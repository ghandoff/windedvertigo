/**
 * Wave 7.1 — Capabilities scaffold.
 *
 * Single source of truth for "can user X do action Y?". This module is pure
 * (no I/O) so it can be imported from both the server runtime and client
 * components. It is **additive**: existing role checks via `hasAnyRole` and
 * `authenticatePcsRead/Write` keep working. New call sites should prefer
 * `can(user, 'namespace:verb')`; old sites migrate opportunistically when
 * touched (full migration is Wave 7.5).
 *
 * Naming convention: `<domain>.<entity>:<verb>` (e.g. `pcs.claims:author`).
 * Dotted form reads better in product-spec docs; colon separates the verb so
 * grep-by-verb stays easy (`grep ':author' src/`).
 *
 * Roles are aliases for sets of capabilities. The matrix lives in
 * `ROLE_CAPABILITY_MAP` below and MUST remain the only place where
 * role→capability mappings are defined. Do not duplicate.
 *
 * Matrix source: docs/plans/wave-7.1-roles-capabilities.md §2
 * 44 capabilities × 5 roles.
 *
 * Derivation strategy: `can()` computes the capability set at call time by
 * unioning the user's roles' arrays. This is cheap (array lookups + Set
 * membership) and avoids a second source of truth on the user object.
 * If profiling ever shows this as hot, memoize via `user._caps` — the
 * function reads that cache first (see session-shape note in the Wave 7.1
 * plan §3, "Session shape (transition-safe)").
 */

/**
 * All capability keys, frozen. Use `CAPABILITIES['pcs.claims:author']`
 * at call sites to get a typo-safe reference.
 */
export const CAPABILITIES = Object.freeze({
  // SQR-RCT scoring
  'sqr.assignments:read-own': 'sqr.assignments:read-own',
  'sqr.scores:create-own': 'sqr.scores:create-own',
  'sqr.scores:edit-own': 'sqr.scores:edit-own',
  'sqr.scores:read-all': 'sqr.scores:read-all',
  'sqr.ai-review:run': 'sqr.ai-review:run',

  // PCS documents
  'pcs.documents:read': 'pcs.documents:read',
  'pcs.documents:edit': 'pcs.documents:edit',
  'pcs.documents:edit-metadata': 'pcs.documents:edit-metadata',
  'pcs.documents:create-version': 'pcs.documents:create-version',
  'pcs.documents:delete': 'pcs.documents:delete',

  // Claims & evidence
  'pcs.claims:read': 'pcs.claims:read',
  'pcs.claims:author': 'pcs.claims:author',
  'pcs.claims:edit': 'pcs.claims:edit',
  'pcs.claims:edit-certainty': 'pcs.claims:edit-certainty',
  'pcs.claims:edit-applicability': 'pcs.claims:edit-applicability',
  'pcs.evidence:read': 'pcs.evidence:read',
  'pcs.evidence:attach': 'pcs.evidence:attach',
  'pcs.evidence:enrich': 'pcs.evidence:enrich',
  'pcs.evidence:flag-safety': 'pcs.evidence:flag-safety',
  'pcs.evidence:send-to-review': 'pcs.evidence:send-to-review',
  // Wave 8 Phase C4 — inline edit of Evidence Packet allowlisted fields
  'pcs.evidence:edit': 'pcs.evidence:edit',

  // Requests (drift / research)
  'pcs.requests:read': 'pcs.requests:read',
  'pcs.requests:create': 'pcs.requests:create',
  'pcs.requests:resolve-research': 'pcs.requests:resolve-research',
  'pcs.requests:resolve-ra': 'pcs.requests:resolve-ra',
  'pcs.requests:reassign': 'pcs.requests:reassign',

  // Imports
  'pcs.imports:read': 'pcs.imports:read',
  'pcs.imports:run': 'pcs.imports:run',
  'pcs.imports:cancel': 'pcs.imports:cancel',
  'pcs.imports:backfill-classification': 'pcs.imports:backfill-classification',

  // Labels (Wave 5)
  'labels:read': 'labels:read',
  'labels:upload': 'labels:upload',
  'labels:approve-extraction': 'labels:approve-extraction',
  'labels:resolve-drift': 'labels:resolve-drift',

  // Ingredients / taxonomy
  'pcs.taxonomy:read': 'pcs.taxonomy:read',
  'pcs.taxonomy:edit': 'pcs.taxonomy:edit',

  // Exports
  'pcs.export:pdf': 'pcs.export:pdf',
  'pcs.export:docx': 'pcs.export:docx',
  'pcs.export:csv': 'pcs.export:csv',

  // Users
  'users:read': 'users:read',
  'users:invite': 'users:invite',
  'users:edit-role': 'users:edit-role',
  'users:delete': 'users:delete',
  'users:assume-role': 'users:assume-role',

  // Audit & compliance / system
  'audit:read-logs': 'audit:read-logs',
  'audit:read-logs-all': 'audit:read-logs-all',
  'data:export-personal': 'data:export-personal',
  'data:delete-personal': 'data:delete-personal',
  'schema:edit': 'schema:edit',

  // PCS Revisions (Wave 8 Phase A) — audit log of every mutation, revert.
  'pcs.revisions:read': 'pcs.revisions:read',
  'pcs.revisions:revert': 'pcs.revisions:revert',

  // Wave 8 Phase C1 — inline edit of Canonical Claim fields (title, family,
  // notes/guardrails, dedupe decision, etc.). Researcher + RA both hold it;
  // every write routes through mutate() so the revision log captures it.
  'pcs.canonical:edit': 'pcs.canonical:edit',

  // Wave 7.5 prereq — applicability rules (claim ↔ AI ↔ benefit gates).
  // Currently used by /api/pcs/applicability/** GET + POST routes that
  // were unmigrated under the old `authenticatePcsRead/Write` gate. Adding
  // these keys unblocks Wave 7.5 Batch B from migrating those routes.
  'pcs.applicability:read': 'pcs.applicability:read',
  'pcs.applicability:edit': 'pcs.applicability:edit',
});

// ─── Capability bundles (private; composed into role map below) ──────────

const REVIEWER_CAPS = [
  'sqr.assignments:read-own',
  'sqr.scores:create-own',
  'sqr.scores:edit-own',
];

const RESEARCHER_CAPS = [
  'pcs.documents:read',
  'pcs.documents:edit',
  'pcs.documents:edit-metadata',
  'pcs.documents:create-version',
  'pcs.claims:read',
  'pcs.claims:author',
  'pcs.claims:edit',
  'pcs.claims:edit-certainty',
  'pcs.claims:edit-applicability',
  'pcs.evidence:read',
  'pcs.evidence:attach',
  'pcs.evidence:enrich',
  'pcs.evidence:edit',
  'pcs.evidence:flag-safety',
  'pcs.evidence:send-to-review',
  'pcs.requests:read',
  'pcs.requests:create',
  'pcs.requests:resolve-research',
  'pcs.imports:read',
  'pcs.imports:run',
  'pcs.imports:cancel',
  'labels:read',
  'labels:upload',
  'pcs.taxonomy:read',
  'pcs.taxonomy:edit',
  'pcs.export:pdf',
  'pcs.export:docx',
  // Wave 8 Phase A — researchers can see the edit history of anything they touch
  'pcs.revisions:read',
  // Wave 8 Phase C1 — researchers own the canonical-claim vocabulary
  'pcs.canonical:edit',
  // Wave 7.5 prereq — applicability rule curation (Track A of the parallel-stack plan)
  'pcs.applicability:read',
  'pcs.applicability:edit',
];

const RA_CAPS = [
  'sqr.scores:read-all',
  'sqr.ai-review:run',
  'pcs.documents:read',
  'pcs.documents:edit',
  'pcs.documents:edit-metadata',
  'pcs.claims:read',
  'pcs.claims:edit',
  'pcs.evidence:read',
  'pcs.evidence:enrich',
  'pcs.evidence:edit',
  'pcs.evidence:flag-safety',
  'pcs.requests:read',
  'pcs.requests:create',
  'pcs.requests:resolve-ra',
  'pcs.requests:reassign',
  'pcs.imports:read',
  'labels:read',
  'labels:approve-extraction',
  'labels:resolve-drift',
  'pcs.taxonomy:read',
  'pcs.export:pdf',
  'pcs.export:docx',
  'pcs.export:csv',
  // Wave 8 Phase A — RA can see the edit history of anything they touch
  'pcs.revisions:read',
  // Wave 8 Phase C1 — RA can also curate canonical claim metadata
  'pcs.canonical:edit',
  // Wave 7.5 prereq — applicability rule curation (Track A of the parallel-stack plan)
  'pcs.applicability:read',
  'pcs.applicability:edit',
];

/**
 * Deduplicate while preserving first-seen order.
 */
function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

const ADMIN_CAPS = uniq([
  ...RESEARCHER_CAPS,
  ...RA_CAPS,
  'pcs.documents:delete',
  'pcs.imports:backfill-classification',
  'users:read',
  'users:invite',
  'users:edit-role',
  'audit:read-logs',
]);

// Super-user is the god role: holds every capability in the system.
// We derive it from CAPABILITIES rather than unioning other role arrays so
// a newly-added capability can't silently miss super-user (caught the
// 7.1.0 test failure on `sqr.assignments:read-own`, which lived only on
// REVIEWER_CAPS and slipped out of the admin-based super-user union).
const SUPER_USER_CAPS = uniq([
  ...Object.keys(CAPABILITIES),
  ...ADMIN_CAPS,
  'users:delete',
  'users:assume-role',
  'audit:read-logs-all',
  'data:export-personal',
  'data:delete-personal',
  'schema:edit',
]);

/**
 * Canonical role → capabilities map.
 *
 * Legacy role aliases (`pcs`, `pcs-readonly`, `sqr-rct`, `admin`) are
 * preserved during the 7.1 → 7.5 migration so JWTs minted pre-7.1.4
 * keep resolving to sensible capability sets:
 *   - `pcs`         → Researcher caps
 *   - `pcs-readonly` → Researcher caps minus write/author
 *   - `admin`       → Admin caps
 *   - `sqr-rct`     → Reviewer caps
 * Once Wave 7.1.4 migrates Notion records, the new role keys
 * (`reviewer`, `researcher`, `ra`, `admin`, `super-user`) supersede.
 */
export const ROLE_CAPABILITY_MAP = Object.freeze({
  // New-world role names (Wave 7.1.4+)
  'reviewer': Object.freeze([...REVIEWER_CAPS]),
  'researcher': Object.freeze([...RESEARCHER_CAPS]),
  'ra': Object.freeze([...RA_CAPS]),
  'admin': Object.freeze([...ADMIN_CAPS]),
  'super-user': Object.freeze([...SUPER_USER_CAPS]),

  // Legacy aliases (pre-7.1.4 Notion role values).
  'pcs': Object.freeze([...RESEARCHER_CAPS]),
  'pcs-readonly': Object.freeze([
    'pcs.documents:read',
    'pcs.claims:read',
    'pcs.evidence:read',
    'pcs.requests:read',
    'pcs.imports:read',
    'labels:read',
    'pcs.taxonomy:read',
    'pcs.export:pdf',
    'pcs.export:docx',
  ]),
  'sqr-rct': Object.freeze([...REVIEWER_CAPS]),
});

/**
 * Capability keys that require live Notion re-verification before granting.
 * The server-side `requireCapability` helper delegates to `requireAdminLive`
 * for anything in this set. Currently: every super-user-only capability plus
 * admin-scoped user lifecycle actions where stale JWTs must not win.
 */
export const SUPER_USER_ONLY_CAPABILITIES = Object.freeze(new Set([
  'users:delete',
  'users:assume-role',
  'audit:read-logs-all',
  'data:export-personal',
  'data:delete-personal',
  'schema:edit',
  // Wave 8 Phase A — revert is nuclear: it rewrites the live entity.
  // Locking to super-user + live Notion re-verify prevents a stolen
  // admin JWT from undoing anybody's work.
  'pcs.revisions:revert',
]));

// ─── Public helpers ──────────────────────────────────────────────────────

/**
 * Resolve the effective roles for a user, honoring the Wave 7.0.2 legacy
 * `isAdmin` boolean fallback. Duplicates `resolveRoles` from `has-any-role.js`
 * on purpose — this module is meant to be self-contained so it can migrate
 * to its own package later without a cross-import.
 */
function resolveRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles;
  if (user?.isAdmin) return ['admin'];
  return [];
}

/**
 * Compute the full capability Set for a list of role names. Unknown roles
 * contribute nothing — no errors, no warnings (legacy JWTs may carry roles
 * we no longer recognize).
 *
 * @param {string[]} roles
 * @returns {Set<string>}
 */
export function capabilitiesFor(roles = []) {
  const set = new Set();
  if (!Array.isArray(roles)) return set;
  for (const role of roles) {
    const caps = ROLE_CAPABILITY_MAP[role];
    if (!caps) continue;
    for (const cap of caps) set.add(cap);
  }
  return set;
}

/**
 * Primary capability check. Returns false for nullish users.
 *
 * @param {{ roles?: string[], isAdmin?: boolean, _caps?: Set<string> } | null | undefined} user
 * @param {string} capability
 * @returns {boolean}
 */
export function can(user, capability) {
  if (!user) return false;
  if (typeof capability !== 'string' || capability.length === 0) return false;
  // Memoized cache (future-compatible with a provider-level derivation).
  if (user._caps instanceof Set) return user._caps.has(capability);
  const caps = capabilitiesFor(resolveRoles(user));
  return caps.has(capability);
}

/**
 * True iff the user has ANY of the given capabilities. Empty list → false.
 */
export function canAny(user, capabilities) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) return false;
  if (!user) return false;
  const caps = user._caps instanceof Set ? user._caps : capabilitiesFor(resolveRoles(user));
  return capabilities.some((c) => caps.has(c));
}

/**
 * True iff the user has ALL of the given capabilities. Empty list → true
 * (vacuous — matches standard set semantics; callers that want "empty means
 * no" should guard explicitly).
 */
export function canAll(user, capabilities) {
  if (!Array.isArray(capabilities)) return false;
  if (capabilities.length === 0) return true;
  if (!user) return false;
  const caps = user._caps instanceof Set ? user._caps : capabilitiesFor(resolveRoles(user));
  return capabilities.every((c) => caps.has(c));
}

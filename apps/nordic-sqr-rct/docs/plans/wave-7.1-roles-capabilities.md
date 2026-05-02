# Wave 7.1 — Roles & Capabilities

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** None hard. Plays well with Wave 4.5 (Requests) and Wave 5 (Labels).

---

## 1. Current state audit

Today's auth model is a **flat roles array** persisted on the Reviewer record in Notion (`'sqr-rct' | 'pcs' | 'pcs-readonly' | 'admin'`) plus a legacy boolean `isAdmin` checkbox. The JWT carries both. Two middleware helpers (`authenticatePcsRead`, `authenticatePcsWrite` in `src/lib/pcs-auth.js`) fan out across the server; `verifyAdminFromNotion` from `src/lib/auth.js` gates the admin/analytics surface. Client UI gates via ad-hoc `user?.roles?.includes(...)` expressions sprinkled through pages and components.

### Gate inventory

| Tier | Mechanism | Occurrences | Location |
|---|---|---|---|
| Server — PCS read/write | `authenticatePcsRead`, `authenticatePcsWrite` | **176 call sites across 67 route files** (every `src/app/api/pcs/**/route.js`, plus `src/app/api/admin/imports/**`, `src/app/api/admin/labels/imports/**`) | `src/lib/pcs-auth.js` |
| Server — admin/analytics | `verifyAdminFromNotion` | **36 call sites across 19 route files** (analytics, exports, backfills, AI-review, reviewer CRUD, sync status) | `src/lib/auth.js` |
| Server — SQR-RCT review | `authenticateRequest` + bespoke `isAdmin`/`scores` logic | scattered (`src/app/api/scores/route.js`, `src/app/api/studies/**`, `src/app/api/ai-review/chat/route.js`) | no shared helper |
| Client — PCS write | `hasPcsWriteAccess(user)` inline function | at least 3 files: `PcsNav.js`, `pcs/data/page.js`, `components/pcs/CommentThread.js` — each **redefines the same ternary** (`user?.roles?.length > 0 ? user.roles : user?.isAdmin ? ['sqr-rct','pcs','admin'] : []`) | duplicated |
| Client — `canWrite` | `user?.roles?.includes('pcs') \|\| user?.roles?.includes('admin') \|\| user?.isAdmin` | **8+ pages**: documents detail, claims detail, claims applicability, claims certainty, evidence detail, evidence list, living-view, etc. | inline everywhere |
| Client — admin chip | `user?.isAdmin` | Navbar, PcsNav (desktop + mobile), Footer, AdminRoute, request side sheet | 5+ places |
| Client — nav filter | `writeOnly` flag on nav item objects | `PcsNav.js`, `pcs/data/page.js` (tab strip) | 2 surfaces |

**Rough total:** ~230 distinct gating expressions today. After de-duplication under a capability model, the effective count drops to **~35–45 capability keys** checked from roughly the same ~230 sites — the sites stay, but every one becomes `can(user, 'entity:verb')` instead of an ad-hoc role ternary.

### Inconsistencies worth calling out

1. **Two sources of truth for admin-ness.** Some routes check `user.isAdmin` from the JWT; others re-verify via `verifyAdminFromNotion`. Only the latter survives a privilege revocation without a re-login. PCS write already handles this correctly by re-reading the Reviewer row; admin routes that trust the JWT do not.
2. **The `isAdmin → ['sqr-rct','pcs','admin']` fallback ternary is copy-pasted in ~6 files.** Any change to the fallback means finding all of them.
3. **`writeOnly` is a UI-only shortcut** that happens to line up with `pcs` role but isn't named as such — a future "RA can view imports but not run them" role distinction breaks it.
4. **Admin reviewers UI toggles `isAdmin` checkbox** (`src/app/admin/reviewers/page.js` line 106) while the `roles` array is set elsewhere at login. There's no UI to edit roles directly — promotions happen in Notion.
5. **SQR-RCT scoring surfaces are not integrated** with the PCS role model at all. `sqr-rct` is *assumed* via the JWT fallback, not granted. An external reviewer who never scores PCS still gets it.

---

## 2. Capability matrix

Capabilities are named `<domain>.<entity>:<verb>`. A role is an **alias** for a set of capabilities. `can(user, capability)` is the only check in code.

| Capability | Reviewer | Researcher | RA | Admin | Super-user |
|---|:-:|:-:|:-:|:-:|:-:|
| **SQR-RCT scoring (external work)** | | | | | |
| `sqr.assignments:read-own` | ✓ | — | — | — | ✓ |
| `sqr.scores:create-own` | ✓ | — | — | — | ✓ |
| `sqr.scores:edit-own` | ✓ | — | — | — | ✓ |
| `sqr.scores:read-all` | — | — | ✓ | ✓ | ✓ |
| `sqr.ai-review:run` | — | — | ✓ | ✓ | ✓ |
| **PCS documents** | | | | | |
| `pcs.documents:read` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.documents:edit-metadata` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.documents:create-version` | — | ✓ | — | ✓ | ✓ |
| `pcs.documents:delete` | — | — | — | ✓ | ✓ |
| **Claims & evidence** | | | | | |
| `pcs.claims:read` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.claims:author` | — | ✓ | — | ✓ | ✓ |
| `pcs.claims:edit-certainty` | — | ✓ | — | ✓ | ✓ |
| `pcs.claims:edit-applicability` | — | ✓ | — | ✓ | ✓ |
| `pcs.evidence:read` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.evidence:attach` | — | ✓ | — | ✓ | ✓ |
| `pcs.evidence:enrich` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.evidence:flag-safety` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.evidence:send-to-review` | — | ✓ | — | ✓ | ✓ |
| **Requests (drift / research)** | | | | | |
| `pcs.requests:read` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.requests:create` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.requests:resolve-research` | — | ✓ | — | ✓ | ✓ |
| `pcs.requests:resolve-ra` | — | — | ✓ | ✓ | ✓ |
| `pcs.requests:reassign` | — | — | ✓ | ✓ | ✓ |
| **Imports** | | | | | |
| `pcs.imports:read` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.imports:run` | — | ✓ | — | ✓ | ✓ |
| `pcs.imports:cancel` | — | ✓ | — | ✓ | ✓ |
| `pcs.imports:backfill-classification` | — | — | — | ✓ | ✓ |
| **Labels (Wave 5)** | | | | | |
| `labels:read` | — | ✓ | ✓ | ✓ | ✓ |
| `labels:upload` | — | ✓ | — | ✓ | ✓ |
| `labels:approve-extraction` | — | — | ✓ | ✓ | ✓ |
| `labels:resolve-drift` | — | — | ✓ | ✓ | ✓ |
| **Ingredients / taxonomy** | | | | | |
| `pcs.taxonomy:read` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.taxonomy:edit` | — | ✓ | — | ✓ | ✓ |
| **Exports** | | | | | |
| `pcs.export:pdf` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.export:docx` | — | ✓ | ✓ | ✓ | ✓ |
| `pcs.export:csv` | — | — | ✓ | ✓ | ✓ |
| **Users** | | | | | |
| `users:read` | — | — | — | ✓ | ✓ |
| `users:invite` | — | — | — | ✓ | ✓ |
| `users:edit-role` | — | — | — | ✓ | ✓ |
| `users:delete` | — | — | — | — | ✓ |
| `users:assume-role` | — | — | — | — | ✓ |
| **Audit & compliance** | | | | | |
| `audit:read-logs` | — | — | — | ✓ (scoped) | ✓ |
| `audit:read-logs-all` | — | — | — | — | ✓ |
| `data:export-personal` | — | — | — | — | ✓ |
| `data:delete-personal` | — | — | — | — | ✓ |
| `schema:edit` | — | — | — | — | ✓ |

**Count:** 44 capabilities across 5 roles.

### Role definitions (canonical mapping)

```js
// src/lib/auth/roles.js (future)
export const ROLE_CAPABILITIES = {
  reviewer:   [/* sqr.* own-scoped only */],
  researcher: [/* pcs.*:read, pcs.claims:author, imports:run, ... */],
  ra:         [/* pcs.requests:resolve-ra, labels:resolve-drift, evidence:flag-safety, ... */],
  admin:      [/* union(researcher, ra, users:* except delete/assume) */],
  super_user: [/* everything */],
};
```

---

## 3. Concrete code design

### Single source of truth

```js
// src/lib/auth/capabilities.js
export const CAPABILITIES = { /* flat string list, one per row above */ };
export const ROLE_CAPABILITIES = { reviewer: [...], researcher: [...], ... };

export function capabilitiesFor(roles = []) {
  const set = new Set();
  for (const r of roles) for (const c of (ROLE_CAPABILITIES[r] || [])) set.add(c);
  return set;
}

export function can(user, capability, context = {}) {
  if (!user) return false;
  const caps = user._caps || capabilitiesFor(user.roles || []);
  if (!caps.has(capability)) return false;
  // scoped capabilities (e.g. reviewer + studyId)
  if (context.studyId && user.studyScopes && !user.studyScopes.includes(context.studyId)) return false;
  return true;
}
```

### Server guard

Replace `authenticatePcsWrite(req)` call sites with a thin wrapper that takes a capability key:

```js
// src/lib/auth/require.js
export async function requireCapability(request, capability, context) {
  const user = await authenticateRequest(request);
  if (!user) return { error: unauth() };
  // Re-hydrate from Notion for write capabilities (keeps the current "write = re-check" posture).
  const live = WRITE_CAPS.has(capability) ? await refreshUserFromNotion(user) : user;
  if (!can(live, capability, context)) return { error: forbidden(capability) };
  await logCapabilityCheck(live, capability, 'allow', context); // sampled
  return { user: live };
}
```

Migration shim: keep `authenticatePcsWrite` exported as a one-liner that calls `requireCapability(req, 'pcs.documents:edit-metadata')` so routes migrate file-by-file rather than in a single 67-file sweep.

### Client UI

```jsx
// src/components/auth/Can.js
'use client';
import { useAuth } from '@/lib/useAuth';
import { can } from '@/lib/auth/capabilities';
export function Can({ capability, context, fallback = null, children }) {
  const { user } = useAuth();
  return can(user, capability, context) ? children : fallback;
}
```

Usage:

```jsx
<Can capability="pcs.imports:run" fallback={<DisabledButton tooltip="Ask Research" />}>
  <RunImportButton />
</Can>
```

The current duplicated `hasPcsWriteAccess(user)` ternaries collapse into a single `useCan('pcs.documents:edit-metadata')` hook.

### Audit log

Every `requireCapability` and every client `<Can>` that renders a privileged affordance fires a sampled event (1% for reads, 100% for writes, 100% for super-user actions). Rows: `{ userId, capability, outcome, context, ts }`. Persist to a new Notion DB `Audit Log` (or, later, a dedicated store — Notion is fine to start).

### Session shape (transition-safe)

During migration, the JWT carries both `roles` (old) and `capabilities` (new derived set). `useAuth` exposes `user.roles` for backward compatibility and `user.capabilities` for new code. Once all call sites migrate, `roles` becomes a display-only string and all logic reads capabilities.

---

## 4. Reviewer specifics

Reviewers are **external to Nordic**. They are not Nordic staff, they often represent academic or industry collaborators, and their experience should feel like a professional invitation to a single study — not a portal into Nordic's internal operations.

### Auth flow (different from everyone else)

- **Magic-link invite**, not username/password. Admin opens "Invite reviewer," enters email + assigns studies, system sends a signed link good for one pass + sets a cookie. Follow-up visits use session cookie.
- **No `/admin`, `/pcs`, or cross-app chips visible anywhere.** The Reviewer lands on `/reviews` and cannot navigate elsewhere. PcsNav and Navbar both no-op for this role.
- **Branding on the invite page:** "You've been invited by [Nordic reviewer name] to score the following RCTs for study [study name]." Reviewer never sees Nordic's internal workspace name.

### Per-study scoping

Reviewer capabilities must be **scoped per study**. A reviewer on Study A cannot see RCTs from Study B, even if the admin adds them to both later and they share a login.

Recommended session claim:

```json
{
  "sub": "reviewer_xyz",
  "roles": ["reviewer"],
  "studyScopes": ["study_01GF...", "study_01GH..."]
}
```

`can(user, 'sqr.scores:create-own', { studyId })` returns true only when `studyId ∈ user.studyScopes` **and** the underlying assignment row assigns the reviewer.

### What Reviewers cannot see

- PCS workspace (any route under `/pcs`)
- Nordic staff directory
- Other reviewers' scores
- Their own scores on studies they've been removed from (soft-scope — data stays in DB, UI hides)

---

## 5. Super-user / DPO specifics

Garrett is the only super-user. The role exists to (a) debug production, (b) satisfy GDPR-equivalent data-subject requests, and (c) handle user lifecycle actions no one else should be able to trigger alone.

### Audit log read

Super-user reads the full audit log. Admin reads only audit entries for users they administer (excluding other Admins and the Super-user). Log retains: capability, actor, target, outcome, context blob, timestamp, IP hash. Retention: 18 months (GDPR proportionality), then scrub personal identifiers but keep aggregated counts.

### Assume-role / impersonation

High-risk capability. Design:

1. Super-user clicks "Assume role as [alias]" on the Admin users page.
2. A prominent red banner at the top of every page for the duration: *"Acting as [alias]. Your actions are logged. [End session]."*
3. Every write performed during an impersonated session logs **both** the impersonator and the impersonated identity.
4. Auto-expires after 30 minutes of inactivity.
5. Cannot be used to impersonate another Super-user (if we ever have more than one) — that scenario requires breaking-glass out-of-band approval.

### Personal-data export (DPO power)

What Notion holds per person, as of today:
- Reviewer row: alias, email, first/last name, roles, isAdmin, optional bio/profile image URL
- Scores: every RCT score the reviewer has submitted, with per-criterion answers and timestamps
- PCS revision-events: changes the user authored
- Comments: any comment thread entry
- AI-review reliability history: attribution of AI-reviewed items to the human reviewer

The DPO export walks those sources, emits a single JSON + attached files bundle to a signed Blob URL, and emails the user. Goal: response within 30 days of request (GDPR Article 12 timeline).

### User deletion

- **Admin can `users:edit-role`** (downgrade to revoke access) but **cannot delete**.
- **Super-user can `users:delete`** which is soft-delete by default: the Reviewer row is archived, the session is invalidated, the Notion `Deleted` checkbox is set, authored content is reassigned to a placeholder "Former staff" identity.
- **Hard delete** (for GDPR "right to erasure") requires Super-user + a typed confirmation + a reason field. Authored content is either (a) anonymized to "Former staff" or (b) scrubbed entirely, depending on whether the content is regulatory-record (must retain under DSHEA/EU equivalents) or not. The workflow should present this as a pre-computed diff ("these 14 scores will be anonymized, these 2 draft claims will be scrubbed") before execution.

---

## 6. Migration plan

Phased, additive, non-breaking. Each phase is independently deployable.

| Phase | Scope | Effort |
|---|---|---|
| **7.1.0 — Capabilities infra (additive, zero behavior change)** | Add `src/lib/auth/capabilities.js`, `ROLE_CAPABILITIES`, `can()`. At login, derive capabilities from roles and embed in JWT. Expose `user.capabilities` from `useAuth`. No call sites migrate yet. | S |
| **7.1.1 — Server migration: PCS read/write** | Rewrite `authenticatePcsRead` / `authenticatePcsWrite` as `requireCapability` wrappers. The 67 route files keep their current function names; internals change once. | S |
| **7.1.2 — Server migration: admin & analytics** | Replace `verifyAdminFromNotion`-based checks with `requireCapability('users:read')` / `'pcs.export:csv'` / `'audit:read-logs'` etc. 19 route files touched. | M |
| **7.1.3 — Client migration: `<Can>` wrapper + hook** | Ship `<Can>` and `useCan()`. Replace duplicated `hasPcsWriteAccess` functions in `PcsNav.js`, `pcs/data/page.js`, `CommentThread.js`, `LivingPcsView.js`, plus the 8 `canWrite` ternaries in claim/evidence/document pages. | M |
| **7.1.4 — Role split: introduce Researcher vs RA** | Today everyone in PCS is `pcs` or `admin`. Add `researcher` and `ra` roles in Notion, migrate existing Sharon/Adin → `researcher`, future RA hires → `ra`. Keep legacy `pcs` role mapping to `researcher`-equivalent capabilities during transition. | S |
| **7.1.5 — Reviewer auth path** | Magic-link flow, `/reviews` landing, study-scope enforcement, invite UI under Admin. Reviewer becomes a first-class role with a completely different session shape. | L |
| **7.1.6 — Admin user management UI** | `users:invite`, `users:edit-role` — replace the `isAdmin`-toggle-only UI with a full role picker. | M |
| **7.1.7 — Super-user features** | Assume-role with banner + 30-min timer; personal-data export workflow; soft-delete with content reassignment; hard-delete with typed confirmation. | L |
| **7.1.8 — Audit log surface** | New `Audit Log` DB in Notion (or dedicated store). Capability-check events flow in. Admin read view (scoped) + Super-user read view (full). | M |
| **7.1.9 — Deprecate legacy role checks** | Delete `user.isAdmin` branching. Remove the `['sqr-rct','pcs','admin']` fallback ternary from all call sites. Remove `writeOnly` flag on nav items. | S |

Eight to nine waves. Production deploys after 7.1.3 leave the app in a shippable, strictly-better state even if the later phases slip.

---

## 7. Open questions for the user

1. **Scope of Admin role across Nordic.** Does Lauren/Sharon/Gina "Admin" mean admin of the PCS workspace only, or does it also include SQR-RCT reviewer administration (inviting external reviewers)? I've modeled it as "all Nordic internal user lifecycle" but cross-tool admin scope is worth a beat.
2. **Can RA delete their own authored content?** I have RA at zero delete capabilities — they resolve Requests but don't delete Notion rows. Is that correct? Specifically: if RA marks a drift finding as "not actually drift, close," does that delete the Request row or resolve-and-archive?
3. **Researcher + RA overlap on Requests.** I split `pcs.requests:resolve-research` from `pcs.requests:resolve-ra` by request type. Alternative: one `pcs.requests:resolve` that routes based on who the Request is assigned to. Which matches the actual workflow you want?
4. **Legal definition of "personal data" for DPO export.** Nordic operates in EU markets; the list in §5 is my best guess of what counts. Is there an existing Nordic data map / DPIA we should align with?
5. **Soft-delete vs hard-delete default.** Default soft? Default hard-on-request? Legal retention for regulatory records (DSHEA substantiation files) will almost certainly force soft for authored PCS content regardless of user preference — confirm with Nordic legal.
6. **Reviewer email identity.** If a reviewer has already scored studies under `reviewer@someuniv.edu` and their email changes to `reviewer@newuniv.edu`, do we treat them as the same person (merge) or fork? Affects the study-scope design and the DPO export identity resolution.
7. **Audit log retention.** 18 months is my proposal (GDPR proportionality). Nordic-specific requirements may want 24 or 36. Needs a legal signoff.
8. **Assume-role scope.** Should Super-user be able to impersonate a Reviewer (i.e., see exactly what an external reviewer sees)? Useful for debugging, but feels like it crosses a line if the Reviewer isn't aware their session can be viewed. Recommend: impersonating Reviewers requires the Reviewer's active consent (email link they click) rather than unilateral Super-user action.
9. **Where does `sqr-rct` role fit?** Today it's the implicit "any logged-in Nordic user can score RCTs" role. Under the new model, do we keep it as a separate orthogonal capability (`sqr.assignments:read-own`) that any internal role can opt into, or does it collapse entirely into the Reviewer role?
10. **Capability naming convention.** I've used `<domain>.<entity>:<verb>`. The alternative is flatter `pcs_document_edit`. The dotted form reads better; the flat form is easier to grep. Worth picking and sticking with before 7.1.0 ships.

---

## 8. Cross-wave interop notes

- **Wave 4.5 (Requests)** introduces the Research vs RA split in Request resolution — 7.1 formalizes that split as capabilities and removes the current "if admin or pcs role" shortcut.
- **Wave 5 (Labels)** adds `labels:*` capabilities — already in the matrix above. Label-drift resolution is an RA capability.
- **Wave 6 (Data Hub)** already collapsed nav `writeOnly` filtering; 7.1.9 cleans up the residual `writeOnly` prop.
- **Wave 3.7 (template classification)** doesn't touch auth but its backfill endpoint (`/api/admin/imports/backfill-classification`) is a good example of a Super-user-only capability in the wild.

---

*End of plan.*

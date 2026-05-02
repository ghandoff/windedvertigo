# Wave 7.1 — Capabilities Migration Runbook

> **Status:** Scaffold shipped (7.1.0). Per-route migration is Wave 7.5.
> **Audience:** Any engineer touching auth-adjacent code between now and Wave 7.5.

---

## What shipped in 7.1.0

Additive-only scaffold. Nothing existing was rewritten.

| File | Purpose |
|---|---|
| `src/lib/auth/capabilities.js` | `CAPABILITIES`, `ROLE_CAPABILITY_MAP`, `can()`, `canAny()`, `canAll()`, `capabilitiesFor()`. |
| `src/components/auth/Can.js` | Client-side `<Can capability="...">` wrapper. |
| `src/lib/auth/require-capability.js` | Server-side `requireCapability(request, key)` guard. |
| `tests/capabilities.verify.mjs` | Unit tests (run via `npm run verify:capabilities` or `verify:all`). |
| `docs/runbooks/wave-7.1-capabilities-migration.md` | This file. |

The 44 capability keys and 5-role matrix live in the plan: `docs/plans/wave-7.1-roles-capabilities.md` §2.

---

## Mental-model shift

**Before:**
```js
if (user?.roles?.includes('admin') || user?.isAdmin) { /* ... */ }
// or
const gate = await authenticatePcsWrite(request);
```

**After:**
```js
import { can } from '@/lib/auth/capabilities';
if (can(user, 'pcs.claims:author')) { /* ... */ }
// or
import { requireCapability } from '@/lib/auth/require-capability';
const gate = await requireCapability(request, 'pcs.claims:author');
if (gate.error) return gate.error;
const { user } = gate;
```

The shift is from **"which role are you?"** to **"which verb are you allowed to do on which entity?"** Roles become aliases; code reads cleaner and survives role-model refactors (e.g. splitting `pcs` into `researcher` + `ra` in Wave 7.1.4) with zero call-site churn.

---

## Migrating one route at a time (Wave 7.5 playbook)

1. Pick a route file under `src/app/api/pcs/**/route.js` (there are 67).
2. Identify the existing guard:
   - `authenticatePcsRead(request)` → roughly `pcs.<entity>:read`
   - `authenticatePcsWrite(request)` → pick the most specific write cap:
     - documents metadata edit → `pcs.documents:edit-metadata`
     - claim author/approve → `pcs.claims:author`
     - evidence attach → `pcs.evidence:attach`
     - imports run → `pcs.imports:run`
     - etc. (see matrix in plan §2)
3. Replace with `requireCapability(request, '<cap>')`. The return shape is identical (`{ user }` / `{ error }`) — no downstream changes needed.
4. Run `npm run verify:all` and smoke-test the route.
5. Commit one route per commit. This keeps blast radius small and makes `git bisect` trivial if something regresses.

Do **not** bulk-migrate across 67 files in one PR. The existing `authenticatePcsRead/Write` helpers stay exported and working throughout 7.5; mixing old and new is fine.

---

## Client-side migration

Anywhere you see:
```js
const canWrite = user?.roles?.includes('pcs') || user?.roles?.includes('admin') || user?.isAdmin;
{canWrite && <EditButton />}
```

Replace with either:
```jsx
import Can from '@/components/auth/Can';
<Can capability="pcs.documents:edit-metadata"><EditButton /></Can>
```
or, if you need the boolean for conditional styling:
```js
import { can } from '@/lib/auth/capabilities';
const canEdit = can(user, 'pcs.documents:edit-metadata');
```

The duplicated `hasPcsWriteAccess(user)` helpers in `PcsNav.js`, `pcs/data/page.js`, and `components/pcs/CommentThread.js` all collapse into capability checks — but that happens in Wave 7.1.3, not now.

---

## Super-user capabilities need live re-verification

`requireCapability` delegates to `requireAdminLive` (Wave 7.0.1, 30s Notion cache) whenever the requested key is in `SUPER_USER_ONLY_CAPABILITIES`. Currently that set is:

- `users:delete`
- `users:assume-role`
- `audit:read-logs-all`
- `data:export-personal`
- `data:delete-personal`
- `schema:edit`

Stale JWT claims cannot grant any of these. If Notion is unreachable, the guard returns 503 (fail-closed). See `src/lib/auth/require-admin-live.js` for the cache/TTL behavior.

Admin-scoped caps (e.g. `users:edit-role`, `audit:read-logs`) currently run through the **standard JWT path** — we accept up-to-JWT-TTL staleness on those in exchange for not hammering Notion on every users-list load. That trade-off is revisitable in Wave 7.1.6.

---

## Backward compatibility

- `hasAnyRole` / `ROLE_SETS` (Wave 7.0.2) stay exported from `src/lib/auth/has-any-role.js` and remain correct for legacy callers. New code should prefer `can()`.
- Legacy role strings in Notion (`pcs`, `pcs-readonly`, `sqr-rct`, `admin`) are mapped in `ROLE_CAPABILITY_MAP` so JWTs minted pre-7.1.4 keep resolving to sensible capability sets:
  - `pcs` → Researcher capabilities
  - `pcs-readonly` → read-only capability subset
  - `sqr-rct` → Reviewer capabilities
  - `admin` → Admin capabilities
- Legacy `isAdmin: true` boolean with no `roles` array falls back to `['admin']` (same behavior as `resolveRoles` in `has-any-role.js`).

When Wave 7.1.4 migrates Notion to the new role keys (`reviewer`, `researcher`, `ra`, `admin`, `super-user`), the legacy aliases become dead rows in the map — they can be removed in Wave 7.1.9 along with the other legacy cleanups.

---

## Open questions (unchanged from plan §7)

Key items still outstanding for 7.1.4+ and tracked in `docs/plans/wave-7.1-roles-capabilities.md`:

- Does super-user role live in the JWT or is it always live-checked? Currently: capabilities in `SUPER_USER_ONLY_CAPABILITIES` route through `requireAdminLive`, which verifies `isAdmin` — once a `super-user` role exists in Notion, `requireAdminLive` needs to distinguish admin vs. super-user.
- Scoped caps (reviewer `studyId` context, admin audit-log scope). The `can()` signature currently does **not** accept a context object — this is deliberate for 7.1.0 simplicity. Wave 7.1.5 (Reviewer auth) will extend `can(user, capability, context)` per plan §3.
- Audit log emission on capability checks. Not wired in 7.1.0; planned for 7.1.8.

---

## Verification

```bash
npm run verify:capabilities   # unit tests for can/canAny/canAll + matrix invariants
npm run verify:all            # includes the above + existing verifiers
npm run build                 # must succeed — nothing in 7.1.0 should break the build
```

No existing route or component was modified, so behavior is unchanged. If `verify:all` or `build` regresses after pulling 7.1.0, that's a bug — open an issue against this wave.

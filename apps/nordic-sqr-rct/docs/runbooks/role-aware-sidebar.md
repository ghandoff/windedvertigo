# Role-Aware Sidebar — Operator Runbook

> **Audience:** Garrett (DPO), Nordic Research, Nordic RA, Nordic admins.
> **Status:** Live in production as of Wave 7.4 (shipped 2026-05-03). Mounted in `src/app/pcs/layout.js` for all `/pcs/*` routes.
> **Last updated:** 2026-05-03

---

## What it is

The PCS workspace (`/pcs/*`) now renders a left-hand sidebar tailored to the signed-in user's role. The sidebar replaces the old "one-size-fits-all" nav block that had grown to 30+ links over Waves 5–7 and was overwhelming for non-super-users.

Each role sees only the surfaces they can actually act on. Reviewers don't see the sidebar at all because reviewers don't enter `/pcs/*` — their workflow stays at `/dashboard` and `/reviews/*`.

---

## What each role sees

### Researcher (Sharon, Gina, Adin, Lauren)

- **Documents** — `/pcs/documents`
- **Claims** — `/pcs/claims`
- **Canonical Claims** — `/pcs/canonical-claims`
- **Evidence Packets** — `/pcs/evidence`
- **AICS** — `/pcs/aics` (upstream sibling; see `aics-onboarding.md`)
- **Audit Trail** (read-only) — `/admin/audit-trail`
- **Premium (Advanced)** teaser section, locked

### RA (Regulatory Affairs — 2 TBD hires)

Everything researchers see, plus:
- **RA Review Queue** — `/pcs/aics?status=pending`
- **Ingredient Safety** — `/pcs/ingredient-safety`
- **Regulatory Notes** — `/pcs/regulatory`

### Admin

Everything researcher + RA see, plus:
- **Reviewers** — `/admin/reviewers`
- **Capabilities** — `/admin/capabilities`
- **Cron / Background Jobs** — `/admin/cron`

### Super-user (Garrett)

Everything admin sees, plus:
- **Sidebar Preview** (dev tool) — `/admin/sidebar-preview`
- **Premium Preview pages** — unlocks the 4 Premium teaser cards
- **Revert button** in History panels (see `wave-8-living-pcs.md`)
- **Feature flags** — `/admin/flags`

### Reviewer (external Nordic reviewers)

Reviewers do **not** access `/pcs/*` and therefore do not see this sidebar. Their flow lives at:
- `/dashboard` — pending review queue
- `/reviews/[id]` — individual review
- `/profile` — account + password reset

If a reviewer somehow lands on a `/pcs/*` URL (typo or mis-shared link), they hit the route's `requireCapability` gate and are redirected to `/dashboard`.

---

## How the role is derived

`deriveSidebarRole(user)` walks the user's roles in precedence order and returns the first match. The walk order is:

1. `super-user`
2. `admin`
3. `ra`
4. `researcher`
5. `reviewer`

The first role that matches wins. A user with both `admin` and `researcher` shows the admin sidebar.

### Legacy role compatibility

Users provisioned before Wave 7.1.4 (the role split) may still carry legacy role tokens. These are mapped at derivation time:

| Legacy role | Mapped to |
|---|---|
| `pcs` | `researcher` |
| `sqr-rct` | `reviewer` |

This mapping happens inside `deriveSidebarRole`; we don't rewrite the underlying user record. New provisions should always use the canonical role names.

---

## Where to override or preview

### Live mount

The sidebar is rendered by `src/app/pcs/layout.js`. Every page under `/pcs/*` inherits it automatically. There's no per-page opt-out.

### Super-user preview tool

`/admin/sidebar-preview` used to be the only place the sidebar lived (Wave 7.3 staging surface). As of Wave 7.4 it's been repurposed into a developer/preview tool: a super-user can pick a role from a dropdown and see exactly what that role's sidebar looks like, without having to log out and back in.

Use cases:
- QA-ing a new sidebar entry before it ships
- Reproducing a "what does Sharon see?" question without taking over her account
- Spot-checking the legacy-role mapping after a user provision

This page is super-user-gated. If you're an admin or below, you'll get a 403.

### Adding or removing entries

Sidebar definitions live in `src/components/pcs/sidebar/sidebar-config.js` keyed by canonical role. To add a new entry:

1. Append to the appropriate role's array in `sidebar-config.js`.
2. If the entry needs capability gating beyond role membership, wrap the entry's `href` resolution in a `can()` check.
3. Verify on `/admin/sidebar-preview` for each role.
4. No deploy gating — config changes ship with the next push.

---

## Reviewer flow note

Worth restating because it trips people up: **reviewers see no sidebar because they do not visit `/pcs/*`.** The PCS workspace is the internal Nordic surface; the reviewer surface is the external review portal at `/dashboard` and `/reviews/*`. These are intentionally separate and use different layouts.

If Nordic ever wants reviewers to access a PCS surface (e.g. a read-only document view), the current plan is to add a reviewer entry to `deriveSidebarRole`'s legacy list and a reviewer-scoped sidebar config — not to drop reviewers into the existing layouts.

---

## Common questions

**Q: I'm an RA hire and I don't see the RA Review Queue.**
A: Check `/admin/sidebar-preview` while logged in as super-user; pick `ra` from the dropdown. If the entry is there, your account is probably still on the `researcher` role only. Garrett can flip it.

**Q: My sidebar looks wrong after a recent role change.**
A: The sidebar is computed from the session token. Sign out and sign back in to refresh.

**Q: The sidebar disappeared on `/pcs/documents/[id]`.**
A: It shouldn't — the layout wraps the entire `/pcs/*` subtree. If you're seeing this, take a screenshot and ping Garrett. There was a known issue in the Wave 7.4 RC where Word-mode toggle would unmount the layout; that fix shipped in commit b65534d.

**Q: Can I customize my sidebar (e.g. pin favorites)?**
A: Not yet. Personalization is on the Wave 9 backlog.

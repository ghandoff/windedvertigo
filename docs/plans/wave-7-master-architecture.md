# Wave 7 — Master Architecture: One Workspace, Many Roles, One Door

> **Status:** Planning artifact — no application code.
> **Author:** Claude (synthesis), Garrett (direction + locked-in decisions)
> **Date:** 2026-04-21
> **Supersedes:** reads as the umbrella over `wave-7.1-roles-capabilities.md`, `wave-7.2-site-unification.md`, `wave-7.3-login-welcome.md`, and the role-aware extension of `docs/design/nav-redesign.md`.
> **Dependencies:** Wave 6.0 Data Hub (shipped — pattern source for redirect shims); Wave 4.5 Requests (shipped — source of the Research/RA split); Wave 5 Labels (in-flight — contributes `labels:*` capabilities).

---

## §1. Strategic framing

The four open questions we have been turning over in isolation — *who are our roles, is this one site or two, how do people sign in, and how is the nav shaped* — are not four questions. They are one question viewed from four angles:

> **Who is this person, and what is the smallest amount of the workspace they should see right now?**

Every one of the Wave 7 sub-plans answers a slice of that question. Roles & Capabilities answers *who*. Site Unification answers *what they see at all*. Login & Welcome answers *what they see first*. The Nav Redesign answers *what's in front of them as they work*. Treated as separate efforts they drift apart and contradict each other; treated as one architecture, they compose.

We are doing this **now**, in the window between Wave 6.0 (Data Hub) and Wave 8 (Reviewer Community of Practice), for three specific reasons:

1. **Wave 6.0 already collapsed the Operations group under `/pcs/data`.** That move made the remaining flatness of the top nav stand out, and it proved that users tolerate route moves behind 301 redirects without complaint. The muscle-memory window is open.
2. **RA hiring is imminent.** Two RA team members are about to come onboard (per `memory/project_pcs_teams.md`). Shipping them into the current flat, role-blind nav will bake in a set of confusions we will then spend Wave 8 unwinding. Better to ship the role split in front of them, not behind them.
3. **The external-reviewer experience is currently a lie.** A UCSD professor invited to score three RCTs is currently sent to `src/app/page.js`, a marketing page that describes *SQR-RCT Platform* as if it were a product. We have been soft-selling to domain experts. Magic-link invites and a purpose-built reviewer portal are the right answer, and they need the capability scaffold + email-as-key migration to land first.

**What changes structurally.** One workspace shell (`<WorkspaceShell>`) wraps every authenticated route. Capabilities — not roles — gate every server endpoint and every sensitive client affordance. Email, not alias, is the primary key on every user record. Login moves out of the root page into a dedicated `/login`. A shared `/welcome` becomes the single post-login threshold. The nav sidebar is role-aware, with different contents for Reviewer, Researcher, RA, Admin, and Super-user.

**What stays the same.** The Notion data model. The pacific token palette. The Inter typeface. The `/api/*` tree. The `JWT_SECRET` and `sqr_token` cookie. The SQR scoring rubric. The PCS Command Center as the Research team's cockpit. We are not rebuilding the product; we are naming what is already true and collapsing the duplication that the prior fiction has been producing.

This document is **directive**, not a survey. Strong opinions throughout. Where a decision has been made, it is stated as a decision. Open questions are called out explicitly in §7.

---

## §2. Locked-in decisions

These are final. They are reproduced here so no downstream plan re-litigates them.

### 2.1 Magic-link infrastructure

**Internal users** (`@nordicnaturals.com` email suffix) are pre-populated from a team-member list. No external self-sign-up for internal users — the register page becomes an admin-only invite flow, not a public form. Internal primary login path is **email + password**, with magic-link available as a secondary device convenience.

**External reviewers** get magic-link auth, oriented around a community-of-practice model (Wave 8) rather than a transactional one. Each reviewer invitation is a token at `/invite/{token}` that creates the account on first use, sets a session cookie, and drops the reviewer into a first-time welcome. Password is opt-in after first review.

**Super-user (Garrett) requires 2FA in production. Non-negotiable.** Gated by a `PROD_REQUIRE_2FA=true` env flag; deployment tooling blocks production deploys where the flag is unset. TOTP is the minimum acceptable mechanism; WebAuthn is the preference (see §7 open question).

### 2.2 First-paint per role

| Role | First-paint surface |
|---|---|
| Reviewer (returning) | Assigned-studies queue + completed count + one-click "Continue review" CTA |
| Reviewer (first-time invite) | Personalized welcome with study context + 1-screen SQR scoring explainer |
| Researcher (Sharon, Adin) | PCS Command Center with their personal Outstanding Requests pinned |
| RA | Command Center variant with drift findings + critical Requests pinned |
| Admin (Lauren, Sharon, Gina) | Researcher view + 24h team activity summary |
| Super-user (Garrett) | Meta-dashboard (deploy status + cross-team requests + audit log spikes + recent logins) — a different page entirely, not a decorated Command Center. |

This is the table `/welcome` dispatches from. It is the contract for every role's home.

### 2.3 Multi-role default home

**Sticky last choice**, with a reassurance banner in the header reminding the user which role they're currently viewing as: `Viewing as: Researcher · switch role`. Persisted to `localStorage['preferredHome']` plus a server-side echo on the Reviewer row so the sticky choice survives device changes.

### 2.4 Reviewer "all done" experience

**Option C — continuous-engagement reviewer bench / community of practice.** Reviewers who finish their queue do not hit a dead-end "thanks, bye" page. They land on a reviewer-community surface: their badges, recent opportunities that match their specialties, peer activity (if visibility permits), and a CTA to update their profile for future invitations. The *full* community-of-practice build is **Wave 8** — see §5 below — but the hook is installed in Wave 7.3.2 so nobody ever sees the "reviewer orphan" state we'd otherwise ship.

### 2.5 Brand name

**"Nordic Research"** for the umbrella. Rejected: "Workspace" suffix (too literal), "Hub" (corporate-intranet-coded), "Platform" (colourless).

- Internal users see **"Nordic Research"** + their role chip in the header. No sub-label.
- External reviewers see **"Nordic Research — Independent Reviewer Portal"**. The sub-label respects that they are guests in the building, not members of the firm.

One company, two doors into one workspace.

### 2.6 Email migration timing

Email-as-key migration ships **first**, as Wave 7.3.0, before any magic-link or 2FA code is written. Magic links require a deliverable identifier on the user record; we will not ship the auth redesign until that identifier is guaranteed unique and present on every row. Backfill, uniqueness enforcement, and alias-preserved-as-display-name are all part of 7.3.0.

---

## §3. Wave sequencing — the actual order of operations

### 3.1 Dependency diagram

```
                    ┌──────────────────────────────────────────┐
                    │ Wave 7.0.x HOTFIXES (independent)        │
                    │  7.0.1 admin live re-verification        │
                    │  7.0.2 role-fallback helper extraction   │
                    │  7.0.3 sqr-rct as granted role           │
                    └──────────────────────────────────────────┘
                                    │ (none block below)
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │ Wave 7.1 CAPABILITIES SCAFFOLD           │
                    │  additive, no call sites migrate         │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │ Wave 7.3.0 EMAIL-AS-KEY MIGRATION        │
                    │  precondition for magic links + /login   │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │ Wave 7.2.0 SHARED WORKSPACE SHELL        │
                    │  <WorkspaceShell>, no URL moves          │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │ Wave 7.2.1 ROUTE RELOCATION              │
                    │  /reviews/*, /research/pcs/*, 301 shims  │
                    └──────────────────────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    ▼                                ▼
       ┌─────────────────────────┐    ┌─────────────────────────┐
       │ Wave 7.3.1 LOGIN +      │    │ Wave 7.4 ROLE-AWARE     │
       │  MAGIC LINKS + 2FA      │    │  OPTION A SIDEBAR       │
       │  /login extracted       │    │  reads from caps + role │
       └─────────────────────────┘    └─────────────────────────┘
                    │                                │
                    ▼                                │
       ┌─────────────────────────┐                   │
       │ Wave 7.3.2 /welcome     │                   │
       │  role-aware, sticky     │                   │
       └─────────────────────────┘                   │
                    │                                │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │ Wave 7.5 CAPABILITY MIGRATION            │
                    │  requireCapability() everywhere          │
                    │  delete authenticatePcsWrite etc         │
                    └──────────────────────────────────────────┘
```

Every wave in the diagram is **independently shippable**. The arrows are precedence, not bundling. After each wave the product is in a strictly-better state than the wave before; no wave leaves the app in an intermediate-broken state.

### 3.2 Wave-by-wave

**Wave 7.0.x — Hotfixes.** Independent, can ship now, no dependency on the rest.
- *7.0.1* — admin live re-verification against Notion on write paths (the current JWT-trust inconsistency from Wave 7.1 audit §1 finding #1).
- *7.0.2* — extract the `isAdmin → ['sqr-rct','pcs','admin']` fallback ternary into a single helper; delete the ~6 copy-pasted duplicates.
- *7.0.3* — grant `sqr-rct` as an explicit role rather than relying on the JWT fallback (Wave 7.1 §1 finding #5). Eliminates an entire class of "external reviewer accidentally has PCS access because they logged in" scenarios.

These three ship as a single week of polish. They are *not* blocking Wave 7.1 but they clean up the site so the capability scaffold has a sane surface to attach to.

**Wave 7.1 — Capabilities scaffold.** Additive; zero behavior change.
- `src/lib/auth/capabilities.js` — the 44-capability list, `ROLE_CAPABILITIES` map, `can(user, capability, context)` function.
- `<Can capability="...">` client component + `useCan()` hook.
- JWT at login carries both `roles` (legacy) and `capabilities` (derived set). Old `user.roles.includes('admin')` checks keep working verbatim.
- **No call sites migrate yet.** The scaffold sits beside the existing logic, ready to be consumed.

**Wave 7.3.0 — Email-as-Key Migration.** Precondition for magic links; see §2.6.
- Backfill email onto every Reviewer row in Notion. Dry-run first with diff report; commit on approval.
- Add `email` as the unique-indexed column; keep `alias` as display-name-in-rubric only.
- Migration UI: one-time prompt on next login per user — *"Confirm your email"* — catches any stragglers.
- Rollback trivial: alias remains unique-indexed during the transition.

**Wave 7.2.0 — Shared Workspace Shell.** Refactor; no URL moves.
- Extract `Navbar.js` + `PcsNav.js` into one `<WorkspaceShell>` accepting a `variant: 'reviewer' | 'research'` prop, plus a `sidebar` slot.
- Root `layout.js` wraps once; delete the duplicate `AuthProvider` instantiations from `pcs/layout.js` and sub-layouts.
- Primary-role derivation: `src/lib/workspace-variant.js`. Pure function, unit-tested.
- **Observable outcome:** zero URL changes; two nav components collapse to one; every cross-cutting feature from here forward is cheaper.

**Wave 7.2.1 — Route relocation.** The URL moves.
- SQR-RCT routes under `/reviews/*` (most already there; `/dashboard`, `/intake`, `/score`, `/credibility`, `/network`, `/profile` relocate).
- PCS routes under `/research/pcs/*` (from `/pcs/*`).
- Every legacy path 301-redirects — reuse the Wave 6.0 Data Hub redirect pattern and test harness verbatim.
- Middleware gains a **coarse role check at the edge**: users with only `sqr-rct` cannot reach `/research/*` regardless of in-page gates. Defense in depth.

**Wave 7.3.1 — Extracted `/login` + magic links + 2FA.**
- Pull login out of `src/app/page.js` into a real `/login` route. The root page becomes marketing only, with two clearly-labeled CTAs ("Reviewer Login" / "Team Login") — it stops pretending to be both at once.
- Magic-link flow at `/login` for reviewers, default. Password-fallback link visible but de-emphasized.
- Email + password path for internal users, default.
- `PROD_REQUIRE_2FA=true` enforcement on super-user login.
- Invite-token flow `/invite/{token}` — one-time URL that creates the reviewer account + issues session cookie + lands on first-time `/welcome`.

**Wave 7.3.2 — Role-aware `/welcome`.**
- Replaces the inlined `getRedirectPath` from `src/app/page.js`. Every authenticated user crosses `/welcome` exactly once per session.
- Per-role first-paint per §2.2's table.
- Sticky-last-choice for multi-role users, plus the role-reminder banner in the header.
- "All done" reviewer variant hooks into the Wave 8 community-of-practice stubs (see §5).

**Wave 7.4 — Role-aware Option A sidebar.**
- Build the sidebar per `docs/design/nav-redesign.md` Option A, but with the items and groups **determined by role**. Full sketches in §4 below.
- Reads from `user.capabilities` (Wave 7.1) and `user.roles` for primary-role styling.
- Section collapse state persisted to `localStorage` per section per user.
- Mobile: sidebar becomes an overlay drawer behind the existing hamburger.

**Wave 7.5 — Capability migration.**
- Route-by-route, replace `authenticatePcsWrite(req)` call sites with `requireCapability(req, 'pcs.documents:edit-metadata')` (or the appropriate key). 67 route files; aim for 10-15 per PR.
- Replace duplicated `hasPcsWriteAccess(user)` client ternaries with `<Can>` / `useCan()`.
- Delete `user.isAdmin` branching. Delete the `['sqr-rct','pcs','admin']` fallback. Delete `writeOnly` prop on nav items.
- By end of Wave 7.5: **zero `user.roles.includes(...)` expressions** survive in the codebase. Every gate is a capability check.

### 3.3 Critical-path call

The critical path runs **7.0.x → 7.1 → 7.3.0 → 7.2.0 → 7.2.1 → 7.3.1 → 7.3.2 → 7.5**. Wave 7.4 (sidebar) branches off after 7.2.1 and can run in parallel with 7.3.1/7.3.2.

The single most-likely-to-slip step is **7.3.0 email migration**. It touches every user record and cannot be rolled forward if data is mis-backfilled. Treat it as the gate between "we are tidying" (7.0.x, 7.1) and "we are reshaping" (everything downstream). Do not schedule 7.2.0 until 7.3.0 is stable in production for at least a week.

---

## §4. The role-aware Option A sidebar

The original Option A (nav redesign §4 / §6.2) had four universal collapsible groups: Authoring / Operations / Review / System. Under Wave 7, **the groups that appear are determined by the viewer's role**. A Reviewer never sees Authoring. An RA never sees `pcs.imports:run`. A Researcher sees Operations only in its Export tab. This is the point of capabilities: the sidebar is a pure function of `user.capabilities`.

Sketches below. Each uses the pacific token palette; no new colors; widths per the existing `w-56` pattern.

### 4.1 External Reviewer sidebar (3 items, no groups)

```
┌────────────────┐
│ Nordic Research│
│ — Reviewer     │
│                │
│ ◆ My Reviews   │
│   Completed    │
│   Profile      │
│                │
│ [logout]       │
└────────────────┘
```

No group headers — the reviewer's world is small enough to be a flat list. The brand sub-line explicitly reads "Reviewer" so there is never a moment of doubt about which door they came through.

### 4.2 Researcher sidebar (Authoring + Review; no Operations, no System)

```
┌────────────────┐
│ Nordic Research│
│                │
│ ◆ Command Ctr  │
│                │
│ AUTHORING      │
│   Documents    │
│   Claims       │
│   Evidence     │
│   Ingredients  │
│                │
│ REVIEW         │
│   Requests (3) │
│                │
│ [profile]      │
└────────────────┘
```

The Operations group is hidden entirely — not disabled, not tooltipped — because Researchers have no Operations capabilities. Requests shows a live count badge. Command Center is pinned above the groups as the single not-grouped home.

### 4.3 RA sidebar (Review expanded + Operations.Export only)

```
┌────────────────┐
│ Nordic Research│
│                │
│ ◆ Command Ctr  │
│                │
│ REVIEW ▾       │
│   Requests (5) │
│   Drift (2)    │
│                │
│ AUTHORING ▸    │
│   (read-only)  │
│                │
│ OPERATIONS     │
│   Export       │
│                │
│ [profile]      │
└────────────────┘
```

RA leads with Review (expanded by default — it is their home) with live counts on Requests and Drift. Authoring is collapsed and flagged `(read-only)` so RA knows claims/evidence exist to drill into but can't edit. Operations shows only Export (the one admin-lite tool RA uses).

### 4.4 Admin sidebar (Researcher + full Operations)

```
┌────────────────┐
│ Nordic Research│
│                │
│ ◆ Command Ctr  │
│                │
│ AUTHORING ▾    │
│   Documents    │
│   Claims       │
│   Evidence     │
│   Ingredients  │
│                │
│ REVIEW ▾       │
│   Requests (8) │
│   Drift        │
│                │
│ OPERATIONS ▾   │
│   Imports      │
│   Label Imports│
│   Export       │
│                │
│ [profile]      │
└────────────────┘
```

Admin is Researcher plus the full Operations group. No Governance group — Admins administer PCS content, not the system. The distinction between Admin and Super-user matters here: Admin can run imports, Super-user runs the platform.

### 4.5 Super-user sidebar (everything + Governance + role switcher)

```
┌────────────────┐
│ Nordic Research│
│                │
│ ◆ Meta dash    │
│                │
│ AUTHORING ▸    │
│ REVIEW ▾       │
│   Requests     │
│   Drift        │
│   Reviewer act │
│ OPERATIONS ▾   │
│   Imports      │
│   Label Imports│
│   Export       │
│ GOVERNANCE ▾   │
│   Audit log    │
│   Users        │
│   Backups      │
│   Schema       │
│                │
│ [Sticky role   │
│  switcher]     │
│ Currently:     │
│ Super-user     │
│ Switch ▾       │
└────────────────┘
```

The Super-user home is the **Meta dashboard** (not Command Center) — see §2.2. Authoring is collapsed by default (Garrett doesn't author every day). Review leads with Reviewer activity alongside Requests/Drift. Governance is the Super-user-only group: audit log, user lifecycle, backup status, schema tools. The sticky role switcher at the bottom is how Garrett pops into "see what Sharon sees" without leaving the workspace.

### 4.6 What's shared across all five

- Brand block at top: `Nordic Research`, with the sub-line appearing only for external reviewers.
- Logout in the footer. Profile link reachable from every variant.
- ⌘K command palette affordance in the top strip (not the sidebar), installed but hidden until surface count justifies it (per nav redesign §5 recommendation — **do not build palette yet**).
- Every sidebar reads from the **same** `ROLE_CAPABILITIES` map. Adding a capability to a role shows the item; removing it hides the item. No per-role nav code.

---

## §5. Forward-link — Wave 8: Reviewer Community of Practice

Out of scope for Wave 7. Outlined here so the reviewer surfaces we ship in 7.3.1/7.3.2 don't close doors.

Nordic's reviewer model is not transactional ("we paid you, we're done"). It is a **community of practice**: domain experts who repeatedly review studies in their specialty, receive recognition for their contributions, connect with peers in their field, and stay engaged between assignments. Wave 8 builds the surfaces that make this explicit.

Sketch-level scope for Wave 8:

- **Reviewer profile page** (richer than current) — bio, specialties, completed reviews (count + optional titles), badges earned, affiliations, optional publications list.
- **Badging system** — recognition for first review, milestone counts (5, 10, 25, 50), specialty depth, review quality signals (agreement with consensus scores, thoroughness), tenure.
- **Reviewer directory** — Nordic-internal by default; optional opt-in peer visibility for community building. Privacy-first — no reviewer is surfaced to peers without consent.
- **Per-study commemoration** — when a study concludes, each reviewer gets a certificate PDF + citation pack + contribution summary they can share professionally.
- **Opportunity matching** — notifications for new studies that match a reviewer's specialties, not just a blanket "new studies available" blast.
- **Community materials** — occasional curated digests ("what reviewers in omega-3 cognition learned this quarter") to keep reviewers engaged between assignments.

Wave 7's contribution to this future: the /welcome reviewer "all done" variant already shows a stub community surface rather than a dead-end. The `reviewer` capability set already includes `sqr.profile:edit-own`. The route `/reviews/community` is reserved but not implemented.

---

## §6. Forward-link — Wave 6.1: In-app feedback popup

Not blocking Wave 7; could ship in parallel as a small standalone. Outlined here because the user surfaced it in the same breath as the rest of the Wave 7 scope.

Scope sketch for Wave 6.1:

- Floating action button on every authenticated page (the `<WorkspaceShell>` is the obvious host — land it in Wave 7.2.0 or immediately after).
- Modal with category picker (`bug` / `confusion` / `idea` / `other`) + freeform textarea + optional "include screenshot" toggle.
- `POST /api/feedback` → fans out to Slack via the existing `slack-notifier.js` webhook, tagged with page URL, user role, deploy commit SHA, timestamp, and the textarea body.
- Auto-included context keeps the friction floor at zero — the user never has to type *"I'm on the claims page in production"*, the payload already knows.
- Goal: enable Garrett's "constant revision process" with a reporting UX that takes <10 seconds from noticing-the-thing to submitted.

Feasible as a 2-3-day ship after Wave 7.2.0 lands the shell.

---

## §7. Open questions for the user

1. **2FA mechanism for super-user.** TOTP (Authenticator app), WebAuthn (hardware key / Touch ID), or both? **Recommend WebAuthn-first** — strictly better UX once set up, phish-resistant, already supported in every modern browser. TOTP as fallback.
2. **Magic link expiry.** 15 min, 1 hr, or 24 hr? **Recommend 1 hr.** Long enough for a reviewer to leave the email open and come back from lunch; short enough that a stale forwarded link can't be weaponized. 15 min is hostile to casual use; 24 hr is a security smell.
3. **Reviewer profile visibility.** Can reviewers see each other? Nordic-internal only? Affects the Wave 8 community-of-practice shape. Recommend: Nordic-internal by default, reviewer-visible as opt-in ("show my profile to peer reviewers in my specialty").
4. **Audit log retention.** 90 days? 1 year? Indefinite for super-user reads? GDPR-equivalent rules apply if Nordic operates in EU. Wave 7.1 proposed 18 months as GDPR proportionality; confirm with Nordic legal before 7.1.8 ships.
5. **Email infrastructure.** Resend is the natural Vercel fit — recommend it. Cost cliff at >100k emails/month is well above our projected volume for the next 18 months. Confirm before 7.3.0.
6. **Migration safety for email-as-key.** Dry-run + audit step, or just do it? **Recommend dry-run** — write a diff report of every user's proposed email binding, eyeball it, then commit. The cost of a wrong binding is a user locked out of their account; the cost of a dry-run is one afternoon.
7. **Multi-role role chip placement.** Header banner ("Viewing as: Researcher") or sidebar footer? **Recommend header banner** — it's more visible, it's the first thing the user sees on page load, and it doesn't compete with the sidebar's role-aware chrome.
8. **Reviewer onboarding video.** First-time welcome includes a 60-second video explaining SQR scoring, or text-only explainer? Video production is a genuine cost; the current 1-screen text explainer is probably sufficient for reviewers who already have PhDs. **Recommend text-only for Wave 7**, revisit in Wave 8 if reviewer quality variance suggests the tutorial is under-invested.

---

## §8. What you don't have to do

Stated explicitly so scope doesn't creep sideways during the waves.

- **Don't rebuild Notion.** The data model stays. Reviewers, PCS documents, claims, evidence, ingredients, requests — all unchanged. Wave 7 adds an `Audit Log` DB and migrates a key; that's the entire schema delta.
- **Don't rebrand the pacific tokens or change typography.** The visual system is fine. "Nordic Research" is a wordmark swap, not a redesign.
- **Don't migrate users in a big-bang cutover.** Every phase is feature-flagged by role. Start with internal dogfooding (the five-person team), then PCS roles in production, then SQR-RCT in production. Two weeks minimum of production exposure before flag removal.
- **Don't ship the Option A sidebar before the email migration + capability scaffold land.** The sidebar reads from capabilities and assumes every user has an email. Landing it earlier means either hardcoding role-to-items maps (which we then rip out) or shipping a sidebar that silently fails for users mid-migration.
- **Don't build the ⌘K command palette yet.** Revisit when surface count exceeds 15 or when a power user requests it. Premature palette is the classic over-engineering trap.
- **Don't ship the Wave 8 community of practice surfaces inside Wave 7.** Reserve the routes; stub the "all done" reviewer variant; leave the rest for its own plan.

---

## §9. Success criteria

"Wave 7 complete" is concrete, testable, and non-negotiable on these nine points:

1. **Every gated route uses `requireCapability(...)`.** Zero `authenticatePcsWrite` or `verifyAdminFromNotion` calls remain. Verified by grep in CI.
2. **Every user record has email as primary key, alias as display.** Verified by a Notion query that returns zero rows where `email IS NULL` or `email` is non-unique.
3. **One unified `/welcome` post-login.** The inlined `getRedirectPath` in `src/app/page.js` is deleted. Every authenticated session passes through `/welcome` at least once.
4. **One `<WorkspaceShell>` component.** `Navbar.js` and `PcsNav.js` are deleted. Verified by file existence.
5. **External reviewers receive magic-link invites, never land on internal nav.** Edge middleware enforces; verified by a test that signs in as a `reviewer`-only user and asserts `/research/*` returns 403 at the middleware layer, not the page layer.
6. **Garrett uses 2FA in production.** If `PROD_REQUIRE_2FA` is unset or if Garrett's account lacks a 2FA factor, production deployment fails. Enforced in the deploy pipeline, not by convention.
7. **Audit log captures every capability check.** Sampled (1% for reads, 100% for writes, 100% for super-user actions). Rows include actor, capability, outcome, context, timestamp, IP hash.
8. **Sticky last-choice role default works for multi-role users.** Verified by a test that signs in as a multi-role user, navigates to the Researcher variant, signs out, signs back in, and lands on the Researcher variant.
9. **All five role sidebars render correctly per role.** Verified by a component test per role that asserts the exact item set + group structure matches the sketches in §4.

If any of these nine are not true, Wave 7 is not complete, regardless of the wave number on the git log.

---

## §10. Cross-wave interop notes

- **Wave 6.0 (Data Hub).** Redirect shim pattern and test harness reused verbatim for Wave 7.2.1 route relocation. The `/pcs/data` consolidation done in 6.0 is the reason the current flat nav feels flat — shipping 6.0 surfaced the underlying nav problem.
- **Wave 5 (Labels).** Adds `labels:*` capabilities to the matrix (already included). Label-drift resolution maps to the RA role. Label imports gate on `pcs.imports:run`, inherited.
- **Wave 4.5 (Requests).** The Research/RA split in Request resolution was introduced here informally; Wave 7.1 formalizes it as `pcs.requests:resolve-research` vs `pcs.requests:resolve-ra`.
- **Wave 4.3 (Living PCS view).** Continues to be a drill-down from Documents, not a top-level sidebar item. That decision survives Wave 7.4.
- **Wave 3.7 (template classification).** No direct touch, but its backfill endpoint (`/api/admin/imports/backfill-classification`) is the canonical example of a Super-user-only capability and gates on `pcs.imports:backfill-classification`.
- **Wave 8 (Reviewer Community of Practice).** Forward-linked above. Wave 7 reserves routes and installs stubs.
- **Wave 6.1 (In-app feedback popup).** Forward-linked above. Hosts cleanly on the Wave 7.2.0 `<WorkspaceShell>`.

---

*End of master plan.*

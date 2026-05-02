# Wave 7.2 — Site Unification: One Workspace, Two Audiences

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** Wave 7.1 nav redesign (Option A sidebar), Wave 6.0 Data Hub redirect pattern

---

## 1. Current state audit

### 1.1 Route map

The app today is a single Next.js 16 deploy with two surfaces glued at the root. They share one `src/app/layout.js`, one root `page.js` (login/landing), one `src/middleware.js`, and one `globals.css`. The separation is entirely by URL prefix + layout file.

**SQR-RCT surface** (external reviewers + internal reviewers):
- `/` — marketing/login (white-labeled "SQR-RCT Platform")
- `/register` — reviewer self-signup
- `/dashboard` — reviewer home, assignment list, metrics
- `/intake` — new-study intake form (structured article extraction)
- `/score` — 11-question rubric scoring UI
- `/reviews`, `/reviews/[scoreId]` — list + detail of a reviewer's own scores
- `/credibility` — reviewer badges / portfolio
- `/network` — expert-network directory
- `/profile` — user profile + image
- `/analytics` — admin-only metrics
- `/studies/[id]` — article page (shared; Phase 3 assisted-review lives here)
- `/admin/*` — reviewer administration, sync utilities

**PCS surface** (internal Research + RA + admin):
- `/pcs` — Command Center dashboard
- `/pcs/claims`, `/pcs/claims/[id]` — claims library
- `/pcs/evidence`, `/pcs/evidence/[id]` — evidence library
- `/pcs/ingredients`, `/pcs/ingredients/[id]`
- `/pcs/documents`, `/pcs/documents/[id]` — PCS Documents
- `/pcs/requests` — Research Requests queue
- `/pcs/review` — PCS-internal claim review queue
- `/pcs/data` — Wave 6.0 Data Hub (imports, label-imports, export tabs)
- `/pcs/admin/{backfill,imports,labels}` — admin tools

### 1.2 Shared infrastructure (already unified under the hood)

- **Auth.** One `JWT_SECRET`, one `sqr_token` cookie, one `src/middleware.js` that protects every non-`/` prefix. The only split is role gating inside `PcsLayout` (`RoleRoute requires=['pcs', 'pcs-readonly', 'admin']`).
- **User model.** One Notion `Reviewers` DB. Roles array holds `sqr-rct`, `pcs`, `pcs-readonly`, and `admin` side-by-side on the same user record. A single person can be all four.
- **Landing redirect.** `src/app/page.js` already makes the role-aware routing decision today — SQR users go to `/dashboard`, PCS-only users go to `/pcs`. That logic already *encodes the unification question*: the system knows where to send you; the URL trees just pretend to be separate.
- **Tokens + typography.** One `globals.css`, one Tailwind theme (`pacific-*`), one Inter webfont load. No visual separation exists below the nav bar.
- **API surface.** Every `/api/*` handler lives in one tree. PCS routes (`/api/pcs/*`) and SQR routes (`/api/sqr/*`, `/api/scores/*`, etc.) coexist without ceremony.
- **Lib modules.** `src/lib/useAuth.js`, `src/lib/auth.js`, `src/lib/notion.js`, `src/lib/llm.js`, `src/lib/slack-notifier.js`, `src/lib/rate-limit.js` — all imported by both sides.

### 1.3 Duplications worth noting

- **Two top-bars.** `src/components/Navbar.js` (SQR-RCT) and `src/components/pcs/PcsNav.js` are ~95% structurally identical: same logo block, same profile chip, same logout, same mobile hamburger, same cross-link chip to the *other* site. They diverge only in the middle-nav item list. This is the most visible piece of unnecessary duplication in the repo.
- **Two cross-link chips.** The SQR navbar has a green "PCS" chip; the PCS navbar has a blue "SQR-RCT" chip. Each side already knows the other exists and tries to make hopping easy — the UX is admitting the two surfaces belong together.
- **Two landing strategies.** `/` is an SQR-branded marketing page with a "Reviewer Login" card; internal PCS users log in there too and then get bounced to `/pcs`. The landing page is lying to half its audience.

### 1.4 Surprising findings

Three things the audit made explicit that were not obvious going in:

1. **The "two sites" abstraction is already fiction at the routing layer.** One middleware, one cookie, one user record. The only thing that makes it feel like two sites is the two nav components and the URL prefix. Unification is not an architectural migration; it is a naming cleanup.
2. **`/pcs/review` and `/reviews` are semantically adjacent but live on different sides.** A PCS claim review and an SQR study review are different tasks on different data, but the word "review" collides. Unification will force us to pick better nouns.
3. **The SQR landing page already routes by role.** `src/app/page.js` contains the exact logic a unified `/welcome` would need — it just runs at the landing page instead of post-login. The infrastructure for Option B or C is already 80% in place.

---

## 2. The strategic question

These are two apps that share a backend, deploy, and 80% of the UI tokens. They *feel* separate because they live at different URL roots and have different navs. The actual semantic boundary between them is **task-based, not site-based** — reviewers do reviewing, researchers do authoring, auditors do auditing. The data flows across the boundary: an SQR score on an RCT becomes evidence in a PCS; a PCS claim generates a research request that consumes an SQR-scored study.

### The case for unifying

- **Single chrome to maintain.** Every cross-cutting feature (search, audit log, notifications, help, session timeout, theming) currently costs two implementations. One shell means each feature ships once.
- **The data flow is already continuous.** Reviewer SQR scores flow into PCS claim substantiation. Keeping the two surfaces physically separate creates an artificial wall in a connected workflow.
- **Role is the real axis.** The user's roles array already decides what they see. Making the URL tree mirror that axis is clearer than making the URL tree mirror a sales/marketing distinction that doesn't match the product.
- **Onboarding cost.** A new developer currently has to learn two nav components, two layout files, two sets of breadcrumb conventions, and the rule for when to cross-link. One shell collapses that to one mental model.
- **Operator reality.** Sharon, Gina, Adin, and Lauren hold multiple roles. Every day they hop between `/pcs` and `/dashboard` via the cross-link chip. They already experience this as one workspace; the product should honor that.

### The case for keeping two apps

- **Reviewer-facing branding must feel external.** An academic reviewer from UCSD does not want to land on something that reads like a Nordic Naturals intranet. "SQR-RCT" as a standalone brand reinforces academic neutrality. The login page's independent styling is a feature, not an accident.
- **Security blast-radius.** Two code paths for two audiences mean an accidental role-check regression in the PCS shell cannot expose data to an external reviewer, because external reviewers never touch the PCS shell. Mixing reviewer auth with admin auth introduces confused-deputy risk. Role gating must be bulletproof under unification.
- **Onboarding-for-reviewers cost.** External reviewers get an email, click a link, score a study, leave. They should never see navigation they don't need. A unified shell has to work *really hard* to hide internal surfaces from reviewers.
- **SEO + brand separation.** `sqr-rct.nordicresearch.com` as a public-ish URL vs a private PCS workspace gives Marketing and Legal different surfaces to govern.

### Weighing it

The case against unification is entirely about **reviewer experience** and **blast-radius discipline**. Neither case is about the architecture being wrong; both are about the *presentation* to a specific audience. Those concerns are solvable inside a unified app with a role-aware shell — *if* we are disciplined about it.

The case *for* unification, by contrast, is about architectural hygiene that compounds every wave. Every future feature (Wave 5.4 safety workflow, Wave 7.1 sidebar, cross-app search, notifications) is cheaper in a unified shell. The maintenance math favors unification strongly over any 3+-quarter horizon.

**Strong opinion:** unify, with a carve-out that preserves the external-reviewer experience as a distinct sub-brand. This is Option C below.

---

## 3. Recommended architecture — Option C

Three possibilities:

- **A) Two route trees, share infrastructure.** Current state, hardened. Extract the shared top-bar into one component; stop the duplication. No URL moves. Good if branding separation is sacred and unchangeable.
- **B) One route tree, role-aware nav.** `/pcs`, `/reviews`, `/admin` coexist at the root; what each user sees is determined by their role. Good for internal velocity, but the reviewer brand collapses into the internal workspace.
- **C) One workspace umbrella with two sub-brands.** All routes nest under a shared shell that adapts its presentation to the primary role. Internal users see "Nordic Research Workspace." External reviewers see "SQR-RCT Independent Reviewer Portal" — same shell, different first-paint, same codebase.

**Recommend C.** It captures the architectural wins of unification without losing the one thing that actually matters about keeping reviewers separate: their first impression.

### What C looks like concretely

- One `src/app/layout.js` wrapping `AuthProvider`, `ToastProvider`, and a new `<WorkspaceShell>` component.
- `<WorkspaceShell>` reads the user's primary role and renders one of two headers:
  - **Reviewer header** — minimal: logo, "Independent Reviewer Portal" wordmark, profile chip, logout. No sidebar.
  - **Research header** — full: Nordic logo, "Nordic Research Workspace" wordmark, Wave 7.1 sidebar with role-gated groups, profile chip, logout.
- Primary role derivation: if the user has *only* `sqr-rct`, they see the Reviewer header. Any other role combination gets the Research header. Admin override available.
- URL tree reorganizes (phased, with redirects) to:
  - `/reviews/*` — everything a reviewer does (dashboard → home, intake, score, reviews list, credibility, network, profile)
  - `/research/pcs/*` — PCS workspace (current `/pcs/*` content)
  - `/research/*` — future cross-cutting internal tools (search, audit, notifications)
  - `/admin/*` — unchanged, admin-only
- Middleware gains a coarse role check: users with *only* `sqr-rct` cannot access `/research/*` or `/admin/*` at the edge, independent of any in-page role gating. Defense in depth.

Option C is not more code than the current state once the duplication is removed. It is *less* code, plus one conditional in the shell.

---

## 4. Branding strategy

- **Umbrella name:** **Nordic Research Workspace**. Short, accurate, internal-friendly. Alternative considered and rejected: "Nordic Research Platform" (too corporate), "Nordic Intelligence" (overreach). "Workspace" signals "where you do your work," which is what it is.
- **Reviewer sub-brand:** **SQR-RCT Reviewer Portal** (or "Independent Reviewer Portal" if Legal prefers a more neutral name). Keeps the existing acronym that reviewers have been invited under; adds "Portal" to signal "your portal, not our intranet."
- **Colors + typography:** unchanged. Pacific palette, Inter. Both audiences get the same visual language below the header — this is fine; both audiences are serious professionals looking at serious data.
- **Logo treatment:** Nordic mark stays in both headers. For reviewers, the mark is de-emphasized and paired with the SQR-RCT wordmark; for internal users, the mark leads with "Nordic Research Workspace" typeset next to it. Same asset, different hierarchy.
- **Tone in microcopy:** Reviewer-facing strings stay academic-neutral ("Your reviews," "Submit a review," "Your portfolio"). Internal strings stay operational ("Command Center," "Requests queue," "Drift findings"). The shell selects the string pack based on primary role.
- **Email sender:** reviewer notifications send from `reviews@nordicresearch.com` (new); internal notifications from `no-reply@nordicresearch.com` or a PCS-specific alias. Both DKIM-aligned under one domain to avoid deliverability regressions.

---

## 5. Migration plan (Option C)

Four phases. Each phase is independently shippable; nothing below requires a big-bang cutover.

### Phase 1 — Shared shell, no URL changes

- Extract `Navbar.js` and `PcsNav.js` into one `<WorkspaceShell>` component that accepts a `variant: 'reviewer' | 'research'` prop.
- Root `layout.js` wraps the shell once. Remove the duplicate `AuthProvider` instantiations from `pcs/layout.js` and sub-layouts.
- Primary-role derivation lives in one place: `src/lib/workspace-variant.js`. Exported pure function, easy to unit-test.
- **Observable outcome:** no user-facing URL change. Two nav components collapse to one. Every cross-cutting feature from here forward is cheaper.

### Phase 2 — URL reorganization with redirect shims

- Move SQR-RCT routes under `/reviews/*` (most are already there; `/dashboard`, `/intake`, `/score`, `/credibility`, `/network`, `/profile` relocate).
- Move PCS routes under `/research/pcs/*` (from `/pcs/*`).
- Every legacy path 301-redirects to its new home, matching the Wave 6.0 Data Hub redirect pattern.
- Update middleware matcher. Defense-in-depth role check at the edge.
- **Observable outcome:** bookmarked URLs keep working (redirect); new URLs reflect the mental model.

### Phase 3 — Unified `/welcome` post-login

- `/welcome` replaces the hardcoded `getRedirectPath` logic in `src/app/page.js`.
- Reads role, renders a one-screen role-aware welcome: "Jump into your reviews" (reviewer) or "Go to Command Center" / "Go to Requests" / "Go to Data Hub" (internal, based on most-recently-used surface).
- Landing page (`/`) simplifies — it becomes a public marketing face that presents both audiences (one CTA for "Reviewer Login," one for "Team Login") instead of trying to be both at once.
- **Observable outcome:** no more wrong-home bounce. Internal users stop seeing the reviewer-oriented hero.

### Phase 4 — Cross-cutting features layered onto the shell

With one shell in place, the following become single-implementation:

- Global command-palette search (⌘K) across studies, PCS docs, claims, evidence, reviewers
- Unified notification tray (replaces ad-hoc Slack-only notifications in `slack-notifier.js`)
- Session audit trail surfaced in `/research/admin/audit`
- Cross-app breadcrumbs (a PCS Evidence row breadcrumbs back to the SQR score it was sourced from)

None of these are in Wave 7.2 scope; Phase 4 is a placeholder for what unification unlocks.

---

## 6. What this means for the sidebar (Wave 7.1 interop)

Wave 7.1 has the user committed to Option A — a sidebar with four collapsible groups. Unification reshapes that sidebar by role:

**Reviewer sidebar (external + internal reviewers with *only* the `sqr-rct` role):**
- My Reviews
- Completed
- Profile

Three items. No collapsible groups. The reviewer sees their whole world.

**Researcher sidebar (Sharon, Gina, Adin, Lauren — have `sqr-rct` + `pcs`):**
- Authoring (Claims, Evidence, Ingredients, Documents)
- Operations (Requests, Data Hub)
- Review (PCS Review, My SQR Reviews)  ← folds the reviewer surface in as one group
- System (Profile, Help)

**Super-user sidebar (admin):**
- Everything above
- Governance (Admin, Audit, Reviewer management, Sync)

**Key move:** the reviewer's side is a *subset* of the internal side, not a parallel tree. Internal users can always pop into "their SQR reviews" from the same place reviewers live. This closes the current awkwardness where `/pcs/review` and `/reviews` share a word but are different nouns — under unification, we rename `/pcs/review` to `/research/pcs/claim-review` and leave `/reviews` as the reviewer surface.

---

## 7. Open questions for the user

1. **Domain strategy.** Same domain (one cookie, simplest) or sub-domain per audience (`reviewers.nordicresearch.com` vs `workspace.nordicresearch.com`)? Same domain is my default. Subdomain is worth it only if Legal needs the brand split to be DNS-visible.
2. **Reviewer email sender.** `reviews@nordicresearch.com` (new) vs existing `no-reply@nordicnaturals.com`? The first is cleaner for reviewer tone; the second keeps the existing deliverability reputation.
3. **Fate of `/dashboard`.** Once `/welcome` exists, `/dashboard` (reviewer home) becomes redundant. Fold into `/reviews` as the default tab, or keep as a distinct surface? I lean fold — one less route to explain.
4. **PCS brand naming.** Does the PCS team want the "Research Workspace" umbrella rename internally, or do they want to keep "PCS Platform" as the name in their lanes? I'd keep "PCS Command Center" as the name of the first screen within the workspace — the umbrella is the chrome, the Command Center is the app. Both names coexist.
5. **Cross-team data visibility.** Should a Researcher be able to see SQR-RCT reviewer scores on studies that back their PCS docs? Almost certainly yes; the one-direction data flow (score → evidence) makes reviewer scores a legitimate peek for researchers. Confirm before Phase 4.
6. **External reviewer onboarding flow.** Does a reviewer ever need to see their SQR role *plus* some small PCS artifact (e.g., "your review was cited in PCS-0137")? If yes, the reviewer shell needs a read-only peek into PCS — possible, but it expands Phase 1 scope.
7. **Middleware role checks.** Should the edge middleware encode the coarse role-to-surface mapping today, or trust the in-page `RoleRoute` checks? Defense-in-depth argues edge; simplicity argues page. I recommend edge.
8. **Naming of `/reviews` vs `/pcs/review`.** Unification forces this rename. Confirm the new names: `/reviews` = reviewer SQR scoring; `/research/pcs/claim-review` = internal PCS claim vetting. Alternative: rename the PCS side to `/research/pcs/vetting`.

---

## 8. Cross-wave interop notes

- **Wave 7.1 (sidebar).** Directly dependent. The sidebar groups assume unification; shipping 7.1 without 7.2 locks us into the current nav duplication. Land 7.2 Phase 1 before finalizing 7.1's component tree.
- **Wave 6.0 (Data Hub redirects).** The redirect pattern from `/pcs/export` → `/pcs/data` is the template for Phase 2's legacy-URL shims. Reuse the pattern and the test harness.
- **Wave 5.4 (safety workflow).** Slack digest notifications in the workflow are a natural candidate for the unified notification tray in Phase 4. Ship 5.4 with Slack-only notifications; re-home them after 7.2 Phase 4.
- **Wave 4.5 (Research Requests).** Cross-shell notifications and the request queue's notification badge depend on Phase 1's shared shell. No hard block, but Phase 1 makes the queue feel native instead of bolted-on.
- **Auth.** No JWT/cookie changes in Wave 7.2. Middleware gains a role check; token format unchanged. If Wave 8 introduces Auth.js / NextAuth, it lands cleanly on top of the unified shell.

---

## 9. Decision summary

Unify under one workspace umbrella (Option C). Keep the external-reviewer experience visually distinct inside that umbrella via a role-aware shell variant. Migrate in four phases, each independently shippable, with redirect shims preserving every bookmarked URL.

The current "two sites" framing is already a fiction at the routing and auth layers — one middleware, one cookie, one user record, one landing-page redirect already deciding per-role homes. Shipping Wave 7.2 is less about restructuring the app and more about naming what's already true, then collapsing the visible duplication (two nav components, two layouts, two cross-link chips) that the fiction has been producing.

Expect Phase 1 to be a one-week job (shell extraction, pure cleanup, no user-visible URL moves). Phase 2 is the real carrying work — URL moves plus shim coverage plus middleware — closer to two weeks. Phase 3 is a day once Phase 2 lands. Phase 4 is open-ended and lives as a durable bucket for future cross-cutting features.

---

*End of plan.*

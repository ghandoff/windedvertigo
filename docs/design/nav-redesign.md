# Nav Redesign — PCS Workspace

> **Status:** Planning artifact — no application code.
> **Author:** Claude (research + proposals), Garrett (direction)
> **Date:** 2026-04-21
> **Scope:** `src/components/pcs/PcsNav.js` and the shell around it. Does not touch page-level routing.
> **Feeds into:** a future Wave 6.x UI polish pass, and the Research-vs-RA role split surfaced in the PCS teams memo.

---

## §1. Audit — what the nav is today

### 1.1 Enumerated entries

The current primary nav lives in `src/components/pcs/PcsNav.js` (lines 8–18) and renders a single flat top-bar of nine links, plus two secondary "cross-link" chips on the right side, plus a profile avatar and sign-out. Full inventory:

| Label | Route | Visibility | Wave added | Surface type |
|---|---|---|---|---|
| Command Center | `/pcs` | All PCS users | Wave 1 | Dashboard |
| Claims | `/pcs/claims` | All PCS users | Wave 1 | Authoring list |
| Evidence | `/pcs/evidence` | All PCS users | Wave 1 | Authoring list |
| Ingredients | `/pcs/ingredients` | All PCS users | Wave 2 | Reference list |
| Documents | `/pcs/documents` | All PCS users | Wave 3 | Authoring list |
| Requests | `/pcs/requests` | All PCS users | Wave 4.5.1 | Review queue |
| Export | `/pcs/export` | All PCS users | Wave 2 | Operation |
| Import | `/pcs/admin/imports` | `writeOnly` (pcs/admin roles) | Wave 3 | Operation |
| Label Import | `/pcs/admin/labels/imports` | `writeOnly` | Wave 5.3 | Operation |
| SQR-RCT (chip) | `/dashboard` | `sqr-rct` role | Wave 1 | Cross-app link |
| Admin (chip) | `/admin` | `user.isAdmin` | Wave 1 | Cross-app link |
| Profile (avatar) | `/profile` | All | Wave 1 | Account |

Surfaces that exist **but are not in the nav**:

- `/pcs/documents/[id]/view` — the Living PCS View (Wave 4.3). Reached by drilling from Documents.
- `/pcs/review` — a secondary review screen (pre-Requests).
- `/pcs/claims/[id]/applicability` and `/certainty` — per-claim tool tabs.
- `/pcs/admin/backfill` — admin-only maintenance, currently unlinked.
- `/pcs/evidence/import` — a legacy evidence importer route, superseded by `/pcs/admin/imports`.

### 1.2 Visibility + hierarchy today

The only grouping currently expressed is **center (primary) vs. right-chip (cross-app)**. The nine primary items are rendered as siblings with no visual separation — no dividers, no section headers, no sub-menus. `writeOnly` filtering (line 36) hides Import + Label Import from read-only users, so a Research-team reader sees seven items; the full admin sees nine.

### 1.3 Mobile behavior

Responsive: a hamburger at `<md` collapses the entire primary list plus the two cross-links into a single vertical stack (lines 149–181). Escape-key closes, body-scroll is not locked. No search, no collapse-by-group.

### 1.4 What this tells us

- Nine top-level entries is already over Miller's-law comfort (7±2), and two more are queued (Drift for Wave 5; a future Living PCS entry).
- The Import / Label Import / Export trio is the clearest grouping opportunity — three operations, all bulk-data, two admin-only, one universal. Today they are scattered across positions 7-9.
- There is no surface for "things that need my attention" other than Requests, which is itself hidden mid-list. A role-aware inbox is a separate need the current nav cannot express.

---

## §2. Pattern research — what mature products do at 7–15 surfaces

### 2.1 Linear

**Shape:** Collapsible left sidebar. Workspace switcher at top, then fixed sections (`Inbox`, `My Issues`, `Active`), then team-scoped sections expandable inline (`Issues`, `Projects`, `Views`, `Cycles`). Bottom has Settings + help.
**At scale:** never grows horizontally — sections collapse, and ⌘K command palette is the primary fast-travel mechanism. Power users rarely touch the sidebar once memorized.
**Steal:** the *command palette as the real nav* — the sidebar is scaffolding, the palette is where experts live.

### 2.2 Notion

**Shape:** Left sidebar, hybrid tree. Top: Search + Inbox + Settings + Home. Middle: pinned Favorites, then a scrollable hierarchical tree of Teamspaces and pages. The tree is the nav.
**At scale:** handles thousands of entries by being expand/collapse all the way down. Breadcrumb at the top of the content pane does double duty.
**Steal:** the **pinned Favorites section above the tree** — lets a Researcher promote Claims + Documents to the top while Imports stays buried.

### 2.3 Airtable

**Shape:** A top bar with tabs for *views* (Grid, Kanban, Calendar), a base switcher on the left rail. Secondary actions (Extensions, Automations, Interfaces) are behind separate buttons in the top-right.
**At scale:** separates *where you are* (base/table/view) from *what you're doing* (edit, share, automate). Only 4-5 things are ever visible at once.
**Steal:** the separation of **location** from **operation** — Import/Export/Label are operations, not locations.

### 2.4 Figma

**Shape:** Top toolbar with left-aligned document meta, center file-name, right-aligned collaboration. The primary "nav" is file-based: sidebar panels (Layers, Assets) are tools not routes.
**At scale:** Figma actively hides chrome. Files are navigated via the Files hub, not the editor.
**Steal:** less directly relevant — but the instinct to **hide mode-specific chrome** applies to the Living PCS View.

### 2.5 Stripe Dashboard

**Shape:** Left sidebar with five or six fixed top-level sections: *Home*, *Balances*, *Transactions*, *Customers*, *Products*, *Reports*, *More*. "More" expands to a curated drawer of 15+ items. Top bar is reserved for mode switch (Test/Live), search, and account menu.
**At scale:** the **"More" drawer** is the killer move — keeps the visible list short while making everything reachable in one click.
**Steal:** a *"More" or "Tools" drawer* for low-frequency admin operations (Import, Label Import, Backfill, future admin tools).

### 2.6 Vercel Dashboard

**Shape:** Top bar with team switcher + primary tabs (*Overview*, *Integrations*, *Activity*, *Usage*, *Settings*). Project detail pages have their own secondary tab strip. Command palette ⌘K is omnipresent.
**At scale:** never more than 6-7 top-bar items; detail pages use nested tabs.
**Steal:** **nested tab strips on detail pages** instead of new top-level nav entries. The per-claim tools (applicability, certainty) already follow this; extend it.

### 2.7 GitHub

**Shape:** Top bar with 4-5 primary items (Pull requests, Issues, Marketplace, Explore). Inside a repo: a secondary tab strip (Code, Issues, PRs, Actions, Projects, Wiki, Security, Insights, Settings). Everything else is discoverable through repo-scoped tabs.
**At scale:** two-level nav separates workspace from object. The repo tab strip is 8–10 items and stays usable because it's contextual — you're in a repo, these are repo verbs.
**Steal:** the **two-level pattern** — a workspace nav (Command Center, Documents, Claims, Evidence, Ingredients, Requests) and a contextual nav inside each object (Living PCS view has its own tabs).

### 2.8 Supabase Studio

**Shape:** Icon-only left rail (Table Editor, SQL, Database, Auth, Storage, Edge Functions, Realtime, Logs, Reports, API Docs, Settings). Hover tooltips. A secondary panel opens per-section.
**At scale:** icon rail lets 10+ items coexist without text clutter; the tradeoff is discoverability for new users.
**Steal:** the **icon-only rail** if we move to a sidebar — saves horizontal space and scales to 12+ items.

### 2.9 Retool / Salesforce Service Cloud

**Retool:** simple 4-item top bar (Apps, Resources, Workflows, Queries) + a settings drawer. Pushes complexity into the object.
**Salesforce:** the extreme case — *app launcher* (grid of every feature, searchable) is the real nav; the top bar shows only the current app's items. This scales to literally hundreds of surfaces but is infamously confusing.
**Steal from Salesforce's failure:** do not build a launcher until the surface count passes ~20. We are nowhere near that.

### 2.10 Scientific-software space (Zotero, EndNote, Mendeley)

All three use a **three-pane layout**: left collections tree, center item list, right details. Nav is the collections tree — it scales by hierarchy. Relevant because the Research team lives in EndNote daily; they are already trained on tree-based collection nav. **Steal:** in the long run, a collections/saved-views tree under Documents and Evidence would feel native.

### 2.11 Pattern synthesis

| Pattern | Best when | Evidence |
|---|---|---|
| Flat top bar | ≤6 peers | Retool, Vercel |
| Top bar + dropdowns | 6-10 peers with clear groups | GitHub (repo tabs), Stripe Home |
| Left sidebar with sections | 8-15 peers with mixed frequency | Linear, Notion, Stripe, Supabase |
| Icon rail | 10+ peers, text-sparse | Supabase, VS Code |
| Command palette-first | experts, keyboard users | Linear, Vercel, Raycast |
| Nested contextual tabs | object has many verbs | GitHub repo, Vercel project |
| "More" drawer | low-frequency admin tools | Stripe |

---

## §3. Nordic's specific needs

The PCS workspace serves three audiences, not one. The nav today treats them identically.

**Research team (Sharon, Gina, Adin, Lauren).** They author: read PCS documents, draft claims, review evidence, occasionally file a request. They never run Imports. For them the top five surfaces are **Documents, Claims, Evidence, Ingredients, Requests**. Everything else is noise.

**RA team (2 TBD).** They triage: resolve Requests, watch Drift (future), occasionally use Export. Their top surfaces are **Requests, Command Center, Drift (future), Documents**. They also never run Imports.

**Admin (Garrett).** Runs imports, monitors system health, occasionally everything else.

**Future pcs-readonly viewers.** Probably executives or external reviewers. They need **Documents** and possibly **Command Center**, nothing else.

Surfaces cluster naturally into four logical groups:

1. **Authoring** — Documents, Claims, Evidence, Ingredients. The content-production loop.
2. **Operations** — Import, Label Import, Export. Bulk data movement. Mostly admin.
3. **Review** — Command Center, Requests, Drift (Wave 5), Living PCS (Wave 4.3 entry point).
4. **System** — Admin, Profile, SQR-RCT cross-link, Backfill.

The existing flat nav conflates all four groups. Any redesign should make the groups visible — either as sidebar sections, dropdown menus, or a drawer split.

---

## §4. Four concrete proposals

### Option A — Left sidebar with collapsible groups (Linear / Notion hybrid)

```
┌───────────────────┬──────────────────────────────────────┐
│ [N] Nordic PCS  ⌘K│  Breadcrumb > Documents > Omega-3   │
│                   │                                      │
│ ◆ Command Center  │  [page content]                      │
│                   │                                      │
│ REVIEW            │                                      │
│   ● Requests  (3) │                                      │
│   ● Drift     (—) │                                      │
│                   │                                      │
│ AUTHORING         │                                      │
│   ▸ Documents     │                                      │
│   ▸ Claims        │                                      │
│   ▸ Evidence      │                                      │
│   ▸ Ingredients   │                                      │
│                   │                                      │
│ OPERATIONS ▸      │  (collapsed)                         │
│                   │                                      │
│ ── SQR-RCT ──     │                                      │
│ ── Admin    ──    │                                      │
│                   │                                      │
│ [avatar] Sign out │                                      │
└───────────────────┴──────────────────────────────────────┘
```

**Handles 9+ surfaces:** yes — sections collapse; low-frequency Operations group is collapsed by default. Easy to add Drift, Living PCS pins, pcs-readonly hiding.
**Trade-offs:** consumes ~220px of horizontal real-estate permanently (or toggles open/closed like Linear). Mobile has to become a drawer. Higher implementation cost than refactoring the existing top bar.
**Inspired by:** Linear + Stripe. Section headers are the Stripe move; the collapsed Operations group is the Stripe "More" drawer.

### Option B — Top bar with dropdown groups (GitHub / Vercel style)

```
┌────────────────────────────────────────────────────────────┐
│ [N] PCS  │ Home │ Authoring ▾ │ Review ▾ │ Operations ▾ │… │
│          │      │ — Documents │ Requests │ Import         │
│          │      │ — Claims    │ Drift    │ Label Import   │
│          │      │ — Evidence  │          │ Export         │
│          │      │ — Ingredients                            │
└────────────────────────────────────────────────────────────┘
```

**Handles 9+ surfaces:** yes — three dropdowns absorb 9 items, leaving a 4-item top bar (Home, Authoring, Review, Operations) plus chips.
**Trade-offs:** dropdowns require a click to reveal destinations, so discoverability of, say, Ingredients takes 2 interactions. Keyboard-nav and hover behavior need care. Mobile adaptation is clean (dropdowns become accordion sections).
**Inspired by:** GitHub's "Profile ▾" + Vercel's team switcher.

### Option C — Command palette-first + minimal chrome

```
┌────────────────────────────────────────────────────────────┐
│ [N] PCS   Command Center · Requests (3) · Documents   ⌘K  │
└────────────────────────────────────────────────────────────┘
```

Only 3 pinned items in chrome (the hottest: Command Center, Requests with count badge, Documents). Everything else lives behind ⌘K, which opens a palette with fuzzy-matched routes:

```
⌘K ────────────────────────────────
  > ingre                                 
  ● Ingredients                          
  ● Ingredients · Omega-3                
  ● Go to Ingredient → EPA              
─────────────────────────────────────
```

**Handles 9+ surfaces:** infinitely. Palette can include deep links ("Go to claim #1234"), saved filters, user pins.
**Trade-offs:** the Research team are not power users. Without a visible menu, new users (Lauren, the TBD RAs) will be lost. Needs a "More" menu as safety net. Highest implementation cost (palette + indexing).
**Inspired by:** Linear + Raycast + Vercel's ⌘K.

### Option D — Merged surfaces ("Data Hub" + the user's suggestion)

Keep the top-bar shape, but **merge Import, Label Import, and Export into a single `/pcs/data` hub** that presents three tabs internally:

```
Top bar:  Command Center · Documents · Claims · Evidence ·
          Ingredients · Requests · Data ·   [SQR-RCT]·[Admin]

/pcs/data  ┌───────────────────────────────────────────────┐
           │ Import · Label Import · Export                │
           │ ─────────────────────────────────────         │
           │ [selected tab content]                        │
           └───────────────────────────────────────────────┘
```

The top bar drops from 9 to 7 items. The Data hub page shows tabs, and non-admin users see only the Export tab (the others are gated inside the hub instead of hidden from the nav).

**Handles 9+ surfaces:** adequately for today; marginal headroom for Drift and Living PCS if we add them as top-level.
**Trade-offs:** smallest implementation delta — essentially a new route + tab strip + nav pruning. Doesn't solve the role-aware problem or introduce groups for future growth. Best as a **stepping stone**, not an endpoint.
**Inspired by:** GitHub's repo tabs, Airtable's Extensions drawer, and the user's own observation.

---

## §5. Decision matrix + recommendation

| Criterion | A Sidebar | B Top+Dropdowns | C Palette-first | D Merged Data Hub |
|---|---|---|---|---|
| Discoverability (new user) | High | High | Low | High |
| Clicks to any surface | 1 | 2 | 1 (+type) | 1–2 |
| Scales past 12 surfaces | Excellent | Good | Excellent | Poor |
| Mobile translation | Good (drawer) | Excellent (accordion) | Good (palette) | Excellent |
| Screen real-estate cost | High (~220px) | Low | Minimal | Low |
| Role-aware (Research vs RA) | Natural | Feasible | Feasible | Awkward |
| Matches existing Tailwind patterns | Medium | High | High | Very high |
| Implementation cost | Medium-High | Low-Medium | High | Low |
| Future-proof for Drift + Living PCS | Yes | Yes | Yes | No |

### Recommendation

**Ship Option D first as a 1-week tactical fix, then invest in Option A within the next wave or two.** Specifically:

- **Now (this wave):** collapse Import + Label Import + Export into `/pcs/data` with three tabs. Remove Export from the top bar. This alone drops the nav from 9 to 7 items and resolves the immediate clutter complaint. Zero risk to Research-team muscle memory — their hot surfaces (Documents, Claims, Evidence, Ingredients, Requests) stay put.
- **Next (Wave 6.x):** migrate to Option A (left sidebar with collapsible groups). The sidebar is the only pattern that cleanly expresses the four logical groups, supports role-aware rendering (Research gets Authoring expanded, RA gets Review expanded), and has headroom for Drift + Living PCS + future surfaces without renegotiating the layout again.
- **Do not build Option C yet.** ⌘K is a power-user feature and the primary users are not power users. Revisit once there are >15 routes and the Research team has used the product for 3+ months.

The reason for the two-step is simple: Option D is 1-2 days of work and solves 70% of the perceived problem; Option A is 1-2 weeks and solves the rest plus the role-split that Wave 4.5.1 introduced. Doing D first buys time to design A properly and to watch how the RA team actually uses the product once they're onboarded.

---

## §6. Implementation notes for the recommended path

### 6.1 Option D sketch (immediate)

- New route: `src/app/pcs/data/page.js` — renders a `<DataHubTabs>` component that reads `?tab=import|labels|export` from the URL and renders the existing page bodies (refactored out of `/pcs/admin/imports`, `/pcs/admin/labels/imports`, `/pcs/export` into shared panels).
- Tab gating: non-write users see only Export tab; Import and Label Import tabs render a "requires write access" placeholder.
- Update `src/components/pcs/PcsNav.js`: replace the three entries with a single `{ href: '/pcs/data', label: 'Data' }`.
- Keep the old routes as redirects to `/pcs/data?tab=…` for 1 release cycle so existing bookmarks and deep links survive.
- Tailwind: reuse the existing `pacific-50/700` active-tab styling from the claim-detail tab strip pattern.

### 6.2 Option A sketch (next wave)

- New component: `src/components/pcs/PcsSidebar.js` — replaces the center-nav portion of `PcsNav`. The outer `<header>` stays as a thin top strip with logo, breadcrumb, ⌘K (future), profile, sign-out.
- Layout wrapper: `src/app/pcs/layout.js` wraps children in `<div className="flex"><PcsSidebar/><main className="flex-1">...</main></div>`.
- Sidebar structure:
  - Section array, each `{ label, items: [{ href, label, badge?, roles? }] }`.
  - Role filtering identical to current `hasPcsWriteAccess` but applied per-item, with a `roles: ['ra']` option for items that should be de-emphasized for Research (Drift) vs RA.
  - Collapsed state persisted to `localStorage` per section.
  - Badge slot for Requests count (wire to the same count the Command Center pulls).
- Mobile: sidebar becomes an overlay drawer, triggered by the existing hamburger. No change to the `useState(menuOpen)` hook pattern, just different content.
- Accessibility: each section header is a `<button aria-expanded>` + `role="region"`; items use `aria-current="page"` for the active link (today's nav does not do this). Keyboard: `Tab` through items; `Home`/`End` jump to first/last; `Arrow` keys move within a section once focused.

### 6.3 Migration path

1. **Option D ships standalone.** One PR, one route move, a redirect shim. Safe to roll back.
2. **Option A ships behind a feature flag** (`NEXT_PUBLIC_PCS_SIDEBAR_NAV=true` in Preview first, following the Vercel env-parity playbook in `memory/project_vercel_env_preview_parity.md`).
3. Admin (Garrett) runs on sidebar for 1 week; Research team opts in; then default on for everyone, flag removed.

### 6.4 Tailwind / token compatibility

The existing nav uses `pacific` tokens (`bg-pacific-50`, `text-pacific-700`) for active state and `gray-` scale for everything else. Both proposals reuse these tokens verbatim. No new tokens required. The sidebar width (`w-56` = 224px) is within the `max-w-7xl` container math and plays well with Turbopack's Tailwind JIT.

---

## §7. Risks + open questions

- **Research muscle memory.** Sharon, Gina, Adin, Lauren have ~2-3 months of using the current top bar. Any change has a re-training cost. Option D minimizes this (only Export/Import/Label move); Option A resets it. Mitigation: ship D first, announce A with a 1-week preview.
- **Role split pending RA onboarding.** Two RA team members are TBD (from `memory/project_pcs_teams.md`). Designing role-aware nav without knowing the RA workflow is speculative. The Option A sketch allows role filtering but does not require role-specific section ordering at ship; that can land once the RAs are observed.
- **Admin-only items visibility.** Today `writeOnly` hides Import and Label Import entirely. In a sidebar, those items could instead be **shown disabled** with a tooltip so Research users know the operations exist and who to ask. Open question: does hiding or disabling better match the team's mental model? Recommend hiding for Research, showing for RA (they may need to know when an import was last run even if they can't trigger one).
- **Surfaces not yet in the nav.** Living PCS (Wave 4.3) is deliberately a drill-down from Documents, not a top-level — that's correct. Drift (Wave 5) should land as a top-level under **Review** once it ships. Backfill should live under a hypothetical **System / Tools** section accessible only to admins; it should never hit the primary nav.
- **Command palette temptation.** Resisting Option C now is a deliberate call; revisit when surface count > 15 or when a power user requests it. Building a palette before there's demand is the classic over-engineering trap.
- **Cross-app chips (SQR-RCT, Admin).** These are workspace switchers, not nav. In Option A they become a small footer block in the sidebar (matches Linear's workspace switcher position). In Option D they stay as chips.

---

## §8. Summary

The current 9-item flat top bar is at the edge of what flat nav can carry, and Wave 5's Drift + a future role-aware redesign will push it over. Option D (merge the three data-ops surfaces into a `/pcs/data` hub) is a cheap near-term win; Option A (left sidebar with collapsible Authoring / Review / Operations / System groups, à la Linear and Stripe) is the right long-term shape and the one that naturally expresses the Research-vs-RA audience split the team is already planning for. Options B and C are not recommended as primary: B adds click-cost without solving the role problem, and C is premature for a non-power-user audience.

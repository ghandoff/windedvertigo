# creaseworks backlog — 28 february 2026

consolidated from 14 docs in `docs/`. duplicates merged, completed work removed, stale references flagged.

---

## status key

| tag | meaning |
|-----|---------|
| 🔴 | bug or broken — fix before shipping |
| 🟡 | ready to build — code change, no blockers |
| 🟢 | data or config task — no code needed |
| 🔵 | design/research — needs decisions first |
| ⚪ | housekeeping — docs, cleanup |

---

## tier 1 — fix now (bugs + blockers)

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 1 | 🔴 **garbled emoji across 3 files** | ~30 min | audit-2026-02-27 | ~15-20 replacements in playdate-card.tsx, entitled-playdate-view.tsx, sampler/[slug]/page.tsx. most visible bug on the site. |
| 2 | 🔴 **apply migrations 030–033 to neon** | ~5 min | session-status | script ready (`apply-migrations-028-032.mjs`), skips already-applied 028/029. garrett must run locally with DATABASE_URL. adds leaderboard, tinkering_tier, cover_images, stripe_price_id columns. |
| 3 | 🔴 **run smoke test against production** | ~5 min | session-status | `node apps/creaseworks/scripts/smoke-test.mjs https://creaseworks.windedvertigo.com` — 29 routes, validates status codes + meta tags. |
| 4 | 🔴 **packs nav link hidden for authed users** | ~15 min | audit-2026-02-27 | nav-bar.tsx line 121 wraps packs link in `{!isAuthed && ...}`. remove the guard. add packs to mobile bottom tab bar. |

---

## tier 2 — quick wins (high impact, low effort)

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 5 | 🟡 **breadcrumb context from sampler** | ~30 min | audit-2026-02-27 | pass `?from=sampler` query param on redirect; pack playdate page checks for it to show "← back to sampler". |
| 6 | 🟡 **pack preview badges on sampler cards** | ~1 hr | paywall-strategy, engagement-system | add `packInfo` prop to PlaydateCard. show 🔒 {packName} chip for unentitled playdates. highest-leverage FOMO touchpoint. |
| 7 | 🟡 **post-reflection upsell CTA** | ~1 hr | paywall-strategy, engagement-system | after successful run submission, show contextual pack upsell or credit progress. captures peak positive moment. |
| 8 | 🟡 **quick-log photo toast enhancement** | ~1 hr | engagement-system | expandable 3-second toast after quick-log: "📸 add a photo for bonus credit?" progressive disclosure. |
| 9 | 🟢 **tag playdates with campaign_tags in notion** | ~30 min | audit-2026-02-27, paywall-strategy | data entry — tag 4-6 playdates per season. unlocks the already-built seasonal banner on playbook. zero code needed. |
| 10 | 🟡 **lowercase violations in dynamic content** | ~1 hr | ui-ux-critique | gallery/community descriptions, profile dashboard labels ("Total Runs"), badge names use title case. extend css rule or enforce in data layer with `toDisplayCase()`. |

---

## tier 3 — engagement & conversion system

these items build on each other. recommended order: schema → progress bar → upsell section → photo features → pack finder.

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 11 | 🟡 **credit system — queries + API** | ~2 hr | engagement-system | DB tables exist (pending migration 028). build `earnCredits()`, `getBalance()`, `redeemCredits()` server actions. |
| 12 | 🟡 **credit progress bar on playbook** | ~1 hr | engagement-system | "12 / 50 credits toward a free pack" — depends on credit queries (#11). |
| 13 | 🟡 **playbook "unlock more" upsell section** | ~2 hr | paywall-strategy | show 1-2 unowned packs below collections grid, ranked by play-history relevance. |
| 14 | 🟡 **photo consent classification UI** | ~2 hr | engagement-system | three-tier classification (artifact / activity / face) during upload. COPPA 2025 compliance. depends on photo_consents table (migration 029). |
| 15 | 🟡 **photo-first quick reflection button** | ~2 hr | engagement-system | camera icon → opens device camera → auto-creates run with photo. alongside existing quick-log button. |
| 16 | 🟡 **pack finder page improvements** | ~3 hr | paywall-strategy | playdate count per pack, "X families exploring" social proof, seasonal callouts, progress visibility. |

---

## tier 4 — wave 3 features (from session status)

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 17 | 🔵 **admin playdate preview with pack filter toggles** | ~4 hr | session-status (wave 3 phase 1) | not started. admin-only feature for content review. |
| 18 | 🔵 **profile "your journey" redesign** | ~4 hr | session-status (wave 3 phase 2) | owned packs + recommendations. depends on pack query + credit system. |
| 19 | 🔵 **engagement sprint 1 — credits foundation** | ~6 hr | session-status (wave 3 phase 3) | full wiring: earn on reflection, earn on photo, progress display, redemption flow. DB ready after migrations. |
| 20 | 🔵 **engagement sprint 2 — photo consent + upsells** | ~6 hr | session-status (wave 3 phase 4) | COPPA waiver flow, marketing pool, post-reflection upsells, consent revocation. |

---

## tier 5 — content & sync improvements

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 21 | 🟡 **image sync tier 3 — file property extraction** | ~4 hr | image-sync-scope | extract notion file properties (materials covers, pack illustrations) → R2 → postgres. tiers 1+2 (playdate + collection covers) already done. |
| 22 | 🟡 **image sync tier 4 — body content / blocks** | ~8 hr | image-sync-scope | fetch notion block children for full page content. transform to HTML/markdown. largest image sync lift. |
| 23 | 🟡 **rich text formatting in sync** | ~3 hr | notion-database-map | currently strips bold, italic, links during sync. extract and preserve. |
| 24 | 🟢 **notion-as-CMS for /we/ and /do/ page text** | ~2 hr | CLAUDE.md | extend existing sync scripts. scripts/sync-notion-members.js and sync-notion-services.js exist but may need polish. |
| 25 | 🟢 **notion-as-CMS for sqr-rct content** | ~4 hr | CLAUDE.md | longer-term. sqr-rct currently queries notion in real-time. |

---

## tier 6 — UI/UX polish (from brand critique)

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 26 | 🟡 **pack cards — visual differentiation** | ~2 hr | ui-ux-critique | add illustration, icon, or colour accent per pack. currently text-only and identical. |
| 27 | 🟡 **matcher page — more playful treatment** | ~2 hr | ui-ux-critique | larger material pills, playful heading, hover animation on CTA. |
| 28 | 🟡 **custom empty-state illustrations/copy** | ~2 hr | ui-ux-critique | gallery and community pages show generic empty states. use brand voice. |
| 29 | 🟡 **DRAFT badge uses non-brand orange** | ~15 min | ui-ux-critique | replace with sienna/10 bg + sienna text. |
| 30 | 🟡 **footer "let's play." tagline** | ~15 min | ui-ux-critique | add brand closing philosophy to shared footer. |
| 31 | 🔵 **typography scale audit** | ~1 hr | ui-ux-critique | brand guidelines specify 50% ratio hierarchy. current heading sizes don't follow it. |
| 32 | 🔵 **parent site vs creaseworks visual bridge** | ~2 hr | ui-ux-critique | windedvertigo.com and creaseworks feel like different products. add cadet section or "what. we. do." typographic echoes. |

---

## tier 7 — accessibility & neurodiversity

the neurodiversity design guide is comprehensive. most foundations are already in place (tokens, reduced-motion, focus-visible, contrast). remaining gaps:

| # | item | effort | source doc | notes |
|---|------|--------|------------|-------|
| 33 | 🔵 **dyslexia-friendly font toggle** | ~2 hr | neurodiversity-guide | add Atkinson Hyperlegible as user-selectable option. store preference in profile. |
| 34 | 🔵 **animation toggle in app settings** | ~1 hr | neurodiversity-guide | separate from OS prefers-reduced-motion. in-app control. |
| 35 | 🔵 **dark/low-colour theme** | ~4 hr | neurodiversity-guide | autism spectrum + sensory sensitivity support. significant CSS work. |
| 36 | 🟡 **progress bars with labels on multi-step flows** | ~1 hr | neurodiversity-guide | "Step 2 of 5" pattern for onboarding, checkout, reflection forms. ADHD-friendly. |

---

## housekeeping — stale docs

| # | item | notes |
|---|------|-------|
| 37 | ⚪ **INFRASTRUCTURE-MIGRATION.md** | very outdated — references GitHub Pages hosting, old single-repo structure, DNS records that have changed. the migration is complete. mark as done or rewrite as a decision log. |
| 38 | ⚪ **NOTION-INTEGRATION.md** | historical comparison of build-time vs client-side sync. creaseworks uses a different pattern entirely (cron + webhook). potentially misleading. archive or add "historical" header. |
| 39 | ⚪ **PLAN-monorepo.md** | completed. should be marked as such. |
| 40 | ⚪ **CREASEWORKS-DESIGN.md** | version 0.3 from 2026-02-16. still broadly accurate but uses "patterns" instead of "playdates" throughout. some sections describe features that are now built. worth a refresh when time allows. |

---

## open questions (need decisions before building)

1. **next/image migration** — should cover images use `<Image>` component with R2 as a custom loader, or continue with `<img>` + CDN URLs? (from image-sync-scope)
2. **R2 bucket separation** — one bucket for all apps or separate per app? (from image-sync-scope)
3. **supabase evaluation** — planned for next new project. is sqr-rct the candidate? (from infrastructure-migration)
4. **vercel pro pricing** — needed for commercial use. is the team on pro yet? (from infrastructure-migration)
5. **URL structure** — creaseworks now lives at windedvertigo.com/reservoir/creaseworks. should old creaseworks.windedvertigo.com subdomain redirect? (from recent work)
6. **shared header/footer across apps** — packages/tokens/footer.html exists. should this extend to a shared header? web components vs HTML partials vs npm package? (from infrastructure-migration)

---

*collated from: CLAUDE.md, CREASEWORKS-DESIGN.md, INFRASTRUCTURE-MIGRATION.md, NOTION-INTEGRATION.md, PLAN-monorepo.md, session-notes.md, creaseworks-audit-2026-02-27.md, creaseworks-paywall-strategy.md, creaseworks-engagement-system.md, creaseworks-image-sync-scope.md, creaseworks-session-status-2026-02-28.md, notion-database-map.md, Creaseworks-Neurodiversity-Design-Guide.docx, creaseworks-ui-ux-critique.docx*

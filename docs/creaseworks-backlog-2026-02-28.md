# creaseworks backlog — 1 march 2026

consolidated from 14 docs. cross-referenced against live codebase + production smoke test.

last audit: 1 march 2026 (claude code session)

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

## completed since last backlog (verified in codebase)

these items were listed as "not started" in the previous backlog but are now implemented:

| old # | item | status |
|-------|------|--------|
| 1 | garbled emoji across 3 files | ✅ fixed — all emoji correct in playdate-card.tsx, entitled-playdate-view.tsx, sampler/[slug]/page.tsx |
| 2 | apply migrations 030–035 to neon | ✅ applied — 031-035 applied 1 march 2026. verification passed. |
| 3 | run smoke test against production | ✅ 28/29 pass (root `/` returns 308 redirect — expected for authed redirect). base URL: `https://windedvertigo.com/reservoir/creaseworks` |
| 4 | packs nav link hidden for authed users | ✅ fixed — packs visible in desktop nav (publicLinks) and mobile bottom tab bar |
| 6 | pack preview badges on sampler cards | ✅ built — `PlaydateCard` accepts `packInfo: PackBadgeInfo` prop, renders 🔒 badge |
| 7 | post-reflection upsell CTA | ✅ built — `RunForm` success state shows pack upsell with `ReflectionPackInfo` |
| 11 | credit system queries + API | ✅ built — `lib/queries/credits.ts` (awardCredit, getUserCredits, spendCredits, checkAndAwardStreakBonus) |
| 12 | credit progress bar on playbook | ✅ built — `credit-progress-bar.tsx` integrated on playbook page |
| 13 | playbook "unlock more" upsell section | ✅ built — `pack-upsell-section.tsx` shows up to 2 unowned packs |
| 14 | photo consent classification UI | ✅ built — `photo-consent-classifier.tsx` with 3-tier COPPA flow |

---

## tier 1 — quick wins (high impact, low effort)

| # | item | effort | notes |
|---|------|--------|-------|
| 1 | 🟡 **breadcrumb context from sampler** | ~30 min | when entitled user clicks sampler playdate → redirected to pack route → breadcrumb says "← back to {pack}". pass `?from=sampler` in redirect; pack playdate page checks for it. |
| 2 | 🟡 **quick-log photo toast enhancement** | ~1 hr | expandable 3-second toast after quick-log: "📸 add a photo for bonus credit?" progressive disclosure. |
| 3 | 🟢 **tag playdates with campaign_tags in notion** | ~30 min | data entry — tag 4-6 playdates per season. unlocks the already-built seasonal banner on playbook. zero code needed. |
| 4 | 🟡 **lowercase violations in dynamic content** | ~1 hr | gallery/community descriptions, profile dashboard labels ("Total Runs"), badge names use title case. enforce lowercase in data layer. |
| 5 | 🟡 **smoke test base URL fix** | ~10 min | smoke-test.mjs needs default base URL updated to include `/reservoir/creaseworks` prefix, or accept it as a documented requirement. |

---

## tier 2 — engagement wiring (code exists, needs integration)

credit queries, photo consent UI, pack upsells, and progress bar components all exist. remaining work is wiring them into the actual user flows.

| # | item | effort | notes |
|---|------|--------|-------|
| 6 | 🟡 **wire credit earning into run submission** | ~1 hr | call `awardCredit()` after successful quick-log (1 credit) and full reflection (1 credit). call after photo upload (2 credits). |
| 7 | 🟡 **wire photo consent into evidence upload** | ~1 hr | show `PhotoConsentClassifier` during photo upload flow in evidence capture. store consent tier in `photo_consents` table. |
| 8 | 🟡 **credit redemption UI** | ~2 hr | profile or playbook page: "redeem 50 credits for a free pack" flow using `spendCredits()`. |
| 9 | 🟡 **photo-first quick reflection button** | ~2 hr | camera icon → opens device camera → auto-creates run with photo. alongside existing quick-log button. |
| 10 | 🟡 **pack finder improvements** | ~3 hr | playdate count per pack, "X families exploring" social proof, seasonal callouts, progress visibility. |

---

## tier 3 — wave 3 features

| # | item | effort | notes |
|---|------|--------|-------|
| 11 | 🔵 **admin playdate preview with pack filter toggles** | ~4 hr | admin-only feature for content review. not started. |
| 12 | 🔵 **profile "your journey" redesign** | ~4 hr | owned packs + recommendations. ProfileDashboard exists with stats/badges/activity — this would extend it with pack-aware content. |

---

## tier 4 — content & sync improvements

| # | item | effort | notes |
|---|------|--------|-------|
| 13 | 🟡 **image sync tier 3 — file property extraction** | ~4 hr | extract notion file properties (materials covers, pack illustrations) → R2 → postgres. tiers 1+2 done. |
| 14 | 🟡 **image sync tier 4 — body content / blocks** | ~8 hr | fetch notion block children for full page content. transform to HTML/markdown. |
| 15 | 🟡 **rich text formatting in sync** | ~3 hr | currently strips bold, italic, links during sync. extract and preserve. |
| 16 | 🟢 **notion-as-CMS for /we/ and /do/ page text** | ~2 hr | extend existing sync scripts. |
| 17 | 🟢 **notion-as-CMS for sqr-rct content** | ~4 hr | longer-term. sqr-rct currently queries notion in real-time. |

---

## tier 5 — UI/UX polish

| # | item | effort | notes |
|---|------|--------|-------|
| 18 | 🟡 **pack cards — visual differentiation** | ~2 hr | add illustration, icon, or colour accent per pack. currently text-only. |
| 19 | 🟡 **matcher page — more playful treatment** | ~2 hr | larger material pills, playful heading, hover animation. |
| 20 | 🟡 **custom empty-state illustrations/copy** | ~2 hr | gallery and community pages show generic empty states. |
| 21 | 🟡 **DRAFT badge uses non-brand orange** | ~15 min | replace with sienna/10 bg + sienna text. |
| 22 | 🟡 **footer "let's play." tagline** | ~15 min | add brand closing philosophy to shared footer. |
| 23 | 🔵 **typography scale audit** | ~1 hr | brand guidelines specify 50% ratio hierarchy. |
| 24 | 🔵 **parent site vs creaseworks visual bridge** | ~2 hr | windedvertigo.com and creaseworks feel like different products. |

---

## tier 6 — accessibility & neurodiversity

| # | item | effort | notes |
|---|------|--------|-------|
| 25 | 🔵 **dyslexia-friendly font toggle** | ~2 hr | Atkinson Hyperlegible as user-selectable option. |
| 26 | 🔵 **animation toggle in app settings** | ~1 hr | separate from OS prefers-reduced-motion. |
| 27 | 🔵 **dark/low-colour theme** | ~4 hr | autism spectrum + sensory sensitivity support. |
| 28 | 🟡 **progress bars with labels on multi-step flows** | ~1 hr | "Step 2 of 5" for onboarding, checkout, reflection forms. |

---

## open questions (need decisions before building)

1. **next/image migration** — cover images use raw `<img>` tags. migrate to `<Image>` with R2 custom loader?
2. **R2 bucket separation** — one bucket for all apps or separate per app?
3. **URL structure** — creaseworks lives at `windedvertigo.com/reservoir/creaseworks`. should the old `creaseworks.windedvertigo.com` subdomain redirect there?
4. **shared header across apps** — footer exists in `packages/tokens/footer.html`. extend to header?

---

## codebase health (1 march 2026)

| metric | value |
|--------|-------|
| TypeScript | compiles clean (zero errors) |
| Migrations | 035 (all applied to Neon) |
| Smoke test | 28/29 pass |
| Source files | ~235 (.ts + .tsx) |
| Features A–Y | all implemented |
| Engagement system | queries + UI built, needs wiring into user flows |

---

*source docs: CLAUDE.md, CREASEWORKS-DESIGN.md, creaseworks-audit-2026-02-27.md, creaseworks-paywall-strategy.md, creaseworks-engagement-system.md, creaseworks-image-sync-scope.md, creaseworks-session-status-2026-02-28.md, notion-database-map.md, memory/projects/creaseworks.md, Creaseworks-Neurodiversity-Design-Guide.docx, creaseworks-ui-ux-critique.docx*

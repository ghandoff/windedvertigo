# creaseworks backlog — 1 march 2026

consolidated from 14 docs. cross-referenced against live codebase + production smoke test.

last audit: 1 march 2026 (claude code session 36 — tier 4 content & sync all complete)

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
| — | dual-scope entitlements (user + org) | ✅ built — migration 038, `checkEntitlement` accepts userId, `grantUserEntitlement`, partial indexes |
| — | per-pack individual invites | ✅ built — `createInviteWithPacks`, `processInvitesOnSignIn`, pack selector UI on admin invites |
| — | org member cap safety valve | ✅ built — `autoJoinOrg` checks `member_cap` before INSERT |
| — | invite link on admin profile | ✅ built — manage section links to `/admin/invites` |
| — | profile pack fetch for org-less users | ✅ built — `getOrgPacksWithProgress` accepts null orgId |

---

## tier 1 — quick wins (high impact, low effort) — ✅ ALL COMPLETE

| # | item | status | notes |
|---|------|--------|-------|
| 1 | **breadcrumb context from sampler** | ✅ done | `?from=sampler` redirect + dynamic breadcrumb in pack playdate page |
| 2 | **quick-log photo toast enhancement** | ✅ done | expandable 5s toast with photo nudge + dismiss, hover pauses timer |
| 3 | **tag playdates with campaign_tags in notion** | ✅ done | session 34 — seed script + commit c5a1605 |
| 4 | **lowercase violations in dynamic content** | ✅ done | session 34 — commit c6255c1 |
| 5 | **smoke test base URL fix** | ✅ done | default already includes `/reservoir/creaseworks` prefix |

---

## tier 2 — engagement wiring — ✅ ALL COMPLETE

verified session 35: all engagement features are fully wired into user flows.

| # | item | status | notes |
|---|------|--------|-------|
| 6 | **wire credit earning into run submission** | ✅ done | `api/runs/route.ts` L115-119: quick_log, find_again, streak_bonus. `api/runs/[id]/evidence/route.ts` L114: photo_added. `api/photo-consents/route.ts` L63: marketing_consent. |
| 7 | **wire photo consent into evidence upload** | ✅ done | `PhotoConsentClassifier` integrated in `evidence-capture-section.tsx`. consent saved via `api/photo-consents` endpoint. |
| 8 | **credit redemption UI** | ✅ done | `credit-redemption.tsx` on playbook page — 3 reward tiers (sampler=10, playdate=25, pack=50). |
| 9 | **photo-first quick reflection button** | ✅ done | `photo-quick-log-button.tsx` — "snap it" camera button in `EntitledPlaydateView`. |
| 10 | **pack finder improvements** | ✅ done | `pack-finder.tsx` — situation picker, social proof, comparison table, seasonal nudges. |

---

## tier 3 — wave 3 features

| # | item | effort | notes |
|---|------|--------|-------|
| 11 | 🔵 **admin playdate preview with pack filter toggles** | ~4 hr | admin-only feature for content review. not started. |
| 12 | 🔵 **profile "your journey" redesign** | ~4 hr | owned packs + recommendations. ProfileDashboard exists with stats/badges/activity — this would extend it with pack-aware content. |

---

## tier 4 — content & sync improvements — ✅ ALL COMPLETE (except #17)

| # | item | effort | notes |
|---|------|--------|-------|
| 13 | ~~image sync tier 3 — file property extraction~~ | ✅ done | playdate illustrations synced via `extractFiles()` → R2. materials don't have image properties in Notion. all cover images (playdates, packs, collections) synced in tiers 1+2. |
| 14 | ~~image sync tier 4 — body content / blocks~~ | ✅ done | `fetchPageBodyHtml()` in `blocks.ts` — recursive block fetch, renders all block types to HTML, syncs inline images to R2. integrated in playdates, packs, collections. |
| 15 | ~~rich text formatting in sync~~ | ✅ done | `extractRichTextHtml()` preserves bold, italic, links, colors, code annotations. HTML columns added to playdates (6), packs (1), collections (1). `SafeHtml` component for progressive enhancement. commit 31a0111. |
| 16 | ~~notion-as-CMS for /we/ and /do/ page text~~ | ✅ done | `syncCmsPages()` fetches individual Notion pages by ID, renders body HTML. `/we/` and `/do/` routes with ISR. `.cms-body` CSS for all block types. commit 48c0725. TODO: add env vars to Vercel. |
| 17 | 🟢 **notion-as-CMS for sqr-rct content** | ~4 hr | longer-term. sqr-rct currently queries notion in real-time. |

---

## tier 5 — UI/UX polish

| # | item | effort | notes |
|---|------|--------|-------|
| 18 | ~~pack cards — visual differentiation~~ | ✅ done | `pack-illustration.tsx` — 6 themed SVG patterns, per-pack color accents, emojis, cover_url support |
| 19 | ~~matcher page — more playful treatment~~ | ✅ done | gradient bg, floating shapes, animated emoji heading, playful copy |
| 20 | ~~custom empty-state illustrations/copy~~ | ✅ done | `empty-state.tsx` — 4 brand-aligned SVG illustrations (bookshelf, journal, magnifier, seedling) |
| 21 | ~~DRAFT badge uses non-brand orange~~ | ✅ done | already uses sienna/30 border + sienna/5 bg + sienna text |
| 22 | ~~footer "let's play." tagline~~ | ✅ done | already in `packages/tokens/footer.html` |
| 23 | ~~typography scale audit~~ | ✅ done | session 34 — commit f3023fe |
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
| Migrations | 038 (all applied to Neon) |
| Smoke test | 28/29 pass |
| Source files | ~235 (.ts + .tsx) |
| Features A–Y | all implemented |
| Engagement system | fully wired — credits, photo consent, redemption, pack finder all live |
| Material emoji CMS | Notion-managed via `emoji` rich_text property, hard-coded map as fallback |

---

*source docs: CLAUDE.md, CREASEWORKS-DESIGN.md, creaseworks-audit-2026-02-27.md, creaseworks-paywall-strategy.md, creaseworks-engagement-system.md, creaseworks-image-sync-scope.md, creaseworks-session-status-2026-02-28.md, notion-database-map.md, memory/projects/creaseworks.md, Creaseworks-Neurodiversity-Design-Guide.docx, creaseworks-ui-ux-critique.docx*

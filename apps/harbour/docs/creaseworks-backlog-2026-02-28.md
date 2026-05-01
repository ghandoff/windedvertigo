# creaseworks backlog — 28 february 2026

consolidated from 14 docs in `docs/`. duplicates merged, completed work removed, stale references flagged.
last verified against codebase: **1 march 2026** (session 34).

---

## status key

| tag | meaning |
|-----|---------|
| ✅ | done — verified in codebase |
| 🔴 | bug or broken — fix before shipping |
| 🟡 | ready to build — code change, no blockers |
| 🟢 | data or config task — no code needed |
| 🔵 | design/research — needs decisions first |
| ⚪ | housekeeping — docs, cleanup |

---

## tier 1 — fix now (bugs + blockers)

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 1 | ~~garbled emoji across 3 files~~ | ~30 min | ✅ done | all emoji verified clean in playdate-card.tsx, entitled-playdate-view.tsx, sampler/[slug]/page.tsx |
| 2 | ~~apply migrations 030–033 to neon~~ | ~5 min | ✅ done | session 31 applied 028–033, session 33 applied 034–035, session 34 applied 038 |
| 3 | ~~run smoke test against production~~ | ~5 min | ✅ done | session 33: 28/29 pass |
| 4 | ~~packs nav link hidden for authed users~~ | ~15 min | ✅ done | packs link now unconditional in publicLinks; present in both mobile tab bars |

**tier 1 is clear.** ✅

---

## tier 2 — quick wins (high impact, low effort)

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 5 | ~~breadcrumb context from sampler~~ | ~30 min | ✅ done | `?from=sampler` param wired; playdate page shows "← back to playdates" |
| 6 | ~~pack preview badges on sampler cards~~ | ~1 hr | ✅ done | PlaydateCard accepts `packInfo` prop, renders 🔒 chip |
| 7 | ~~post-reflection upsell CTA~~ | ~1 hr | ✅ done | pack upsell renders after run submission in RunForm |
| 8 | ~~quick-log photo toast enhancement~~ | ~1 hr | ✅ done | 📸 toast with 5s auto-dismiss, hover to keep, +2 credit nudge |
| 9 | 🟢 **tag playdates with campaign_tags in notion** | ~30 min | ⬜ open | data entry — tag 4-6 playdates per season. zero code needed. |
| 10 | 🟡 **lowercase violations in dynamic content** | ~1 hr | ⚠️ partial | gallery uses lowercase; profile dashboard labels + badge names may still have title case violations |

---

## tier 3 — engagement & conversion system

these items build on each other. recommended order: schema → progress bar → upsell section → photo features → pack finder.

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 11 | 🟡 **credit system — queries + API** | ~2 hr | ⬜ open | DB table exists (migration 028). `earnCredits()`, `getBalance()`, `redeemCredits()` NOT YET BUILT. |
| 12 | 🟡 **credit progress bar on playbook** | ~1 hr | ⚠️ partial | component exists + imported in playbook, but depends on credit queries (#11) which don't exist yet |
| 13 | 🟡 **playbook "unlock more" upsell section** | ~2 hr | ⬜ open | show 1-2 unowned packs below collections grid |
| 14 | 🟡 **photo consent classification UI** | ~2 hr | ⬜ open | three-tier classification. COPPA 2025. photo_consents table exists (migration 029). |
| 15 | 🟡 **photo-first quick reflection button** | ~2 hr | ⬜ open | camera icon → device camera → auto-creates run with photo |
| 16 | 🟡 **pack finder page improvements** | ~3 hr | ⬜ open | playdate count per pack, social proof, seasonal callouts |

---

## tier 4 — wave 3 features (from session status)

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 17 | 🔵 **admin playdate preview with pack filter toggles** | ~4 hr | ⬜ open | admin-only content review |
| 18 | 🔵 **profile "your journey" redesign** | ~4 hr | ⚠️ partial | ProfileJourney component exists with milestones, badges, credits; may overlap with #19 |
| 19 | 🔵 **engagement sprint 1 — credits foundation** | ~6 hr | ⬜ open | earn on reflection, earn on photo, progress display, redemption flow |
| 20 | 🔵 **engagement sprint 2 — photo consent + upsells** | ~6 hr | ⬜ open | COPPA waiver flow, marketing pool, consent revocation |

---

## tier 5 — content & sync improvements

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 21 | 🟡 **image sync tier 3 — file property extraction** | ~4 hr | ⬜ open | materials covers, pack illustrations → R2 → postgres |
| 22 | 🟡 **image sync tier 4 — body content / blocks** | ~8 hr | ⬜ open | fetch notion block children for full page content |
| 23 | ~~rich text formatting in sync~~ | ~3 hr | ✅ done | `extractRichTextHtml()` in sync/extract.ts; HTML columns on playdates_cache, packs_cache, collections; SafeHtml rendering |
| 24 | ~~notion-as-CMS for /we/ and /do/~~ | ~2 hr | ✅ done | /we/ and /do/ pages render from cms_pages table via getCmsPage(); sync scripts exist |
| 25 | 🟢 **notion-as-CMS for sqr-rct content** | ~4 hr | ⬜ open | sqr-rct currently queries notion in real-time |

---

## tier 6 — UI/UX polish (from brand critique)

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 26 | 🟡 **pack cards — visual differentiation** | ~2 hr | ⬜ open | add illustration, icon, or colour accent per pack |
| 27 | 🟡 **matcher page — more playful treatment** | ~2 hr | ⬜ open | larger material pills, playful heading, hover animation |
| 28 | 🟡 **custom empty-state illustrations/copy** | ~2 hr | ⬜ open | gallery and community pages show generic empty states |
| 29 | 🟡 **DRAFT badge uses non-brand orange** | ~15 min | ⬜ open | currently `bg-sienna/80 text-white`; should be `bg-sienna/10 text-sienna` |
| 30 | ~~footer "let's play." tagline~~ | ~15 min | ✅ done | present in packages/tokens/footer.html; rendered via footer.tsx |
| 31 | 🔵 **typography scale audit** | ~1 hr | ⬜ open | brand guidelines specify 50% ratio hierarchy |
| 32 | 🔵 **parent site vs creaseworks visual bridge** | ~2 hr | ⬜ open | the two apps feel disconnected |

---

## tier 7 — accessibility & neurodiversity

most foundations are in place (tokens, reduced-motion, focus-visible, contrast). remaining gaps:

| # | item | effort | status | notes |
|---|------|--------|--------|-------|
| 33 | 🔵 **dyslexia-friendly font toggle** | ~2 hr | ⬜ open | Atkinson Hyperlegible as user option |
| 34 | 🔵 **animation toggle in app settings** | ~1 hr | ⬜ open | separate from OS prefers-reduced-motion |
| 35 | 🔵 **dark/low-colour theme** | ~4 hr | ⬜ open | autism spectrum + sensory sensitivity support |
| 36 | 🟡 **progress bars with labels on multi-step flows** | ~1 hr | ⬜ open | "Step 2 of 5" for onboarding, checkout, reflection |

---

## housekeeping — stale docs

| # | item | status | notes |
|---|------|--------|-------|
| 37 | ~~INFRASTRUCTURE-MIGRATION.md~~ | ✅ done | session 33 archived stale docs |
| 38 | ~~NOTION-INTEGRATION.md~~ | ✅ done | session 33 archived |
| 39 | ~~PLAN-monorepo.md~~ | ✅ done | session 33 archived |
| 40 | ~~CREASEWORKS-DESIGN.md~~ | ✅ done | session 33 updated |

---

## completed outside original backlog

| session | item | notes |
|---------|------|-------|
| 34 | ✅ **dual-scope entitlements (user + org)** | migration 038, checkEntitlement dual-scope, grantUserEntitlement |
| 34 | ✅ **per-pack individual invites** | createInviteWithPacks, processInvitesOnSignIn, pack selector UI |
| 34 | ✅ **org member cap safety valve** | autoJoinOrg checks member_cap before INSERT |
| 34 | ✅ **invite link on admin profile** | manage section shows link to /admin/invites |
| 34 | ✅ **profile pack fetch for org-less users** | getOrgPacksWithProgress now accepts null orgId |
| — | ✅ **champagne text legibility fix** | CSS variable override on phase backgrounds (`.cw-find-bg` etc.) redefines `--wv-champagne` to dark brown `#3a3024` — fixes 30+ components without per-file edits |
| — | ✅ **notion webhook registration** | single webhook → creaseworks handler → incremental postgres sync + fan-out to harbour ISR revalidation |
| — | ✅ **webhook fan-out to harbour** | creaseworks handler forwards raw payload to `/harbour/api/revalidate` (fire-and-forget) for near-instant ISR |
| — | ✅ **NOTION_WEBHOOK_SECRET env vars** | set on both creaseworks and harbour vercel projects (all environments) |

---

## open questions (need decisions before building)

1. **next/image migration** — should cover images use `<Image>` component with R2 as a custom loader, or continue with `<img>` + CDN URLs?
2. **R2 bucket separation** — one bucket for all apps or separate per app?
3. **supabase evaluation** — planned for next new project. is sqr-rct the candidate?
4. **vercel pro pricing** — needed for commercial use. is the team on pro yet?
5. **URL structure** — creaseworks now lives at windedvertigo.com/harbour/creaseworks. should old creaseworks.windedvertigo.com subdomain redirect?
6. **shared header/footer across apps** — packages/tokens/footer.html exists. should this extend to a shared header?

---

*collated from: CLAUDE.md, CREASEWORKS-DESIGN.md, INFRASTRUCTURE-MIGRATION.md, NOTION-INTEGRATION.md, PLAN-monorepo.md, session-notes.md, creaseworks-audit-2026-02-27.md, creaseworks-paywall-strategy.md, creaseworks-engagement-system.md, creaseworks-image-sync-scope.md, creaseworks-session-status-2026-02-28.md, notion-database-map.md, Creaseworks-Neurodiversity-Design-Guide.docx, creaseworks-ui-ux-critique.docx*

# creaseworks — experience review & recommendations

> **STATUS: RESOLVED** — All UX items from this audit have been addressed across sessions 22-32. See `docs/creaseworks-backlog-2026-02-28.md` for the current backlog.

*Session 21 audit — February 25, 2026*

---

## status: no remaining documented objectives

The project-status.md file shows 20 sessions of work culminating in "evidence capture complete." All prior audit findings have been resolved, tests pass (53), and the app is live on Vercel. The collections sync was fixed this session (duplicate slug constraint + Next.js 15 async params). There are no outstanding TODOs in the codebase.

---

## part 1: UX audit — what's working and what needs attention

### what's working well

The core loop is solid: browse playdates → try one → log a reflection → capture evidence → track progress. The design language is cohesive (warm, muted palette, lowercase typography, generous whitespace). The matcher is the standout feature — selecting materials you have on hand and filtering by context is genuinely useful and differentiating.

The four-tier access model (sampler → explorer → practitioner → collective at free/$29/$49/$99) creates a clear upgrade path. Collections with progress tracking and the badge system (tried it → found something → folded & unfolded → found again) give users a reason to come back.

### bugs and data issues spotted

1. ~~**"function tag scavenger" has a broken headline** — the text "find objects. name functions. make play." repeats 3 times in the headline field. This is a Notion data issue, not a code bug. Fix it in the Notion playdates database.~~ **RESOLVED (session 22)** — headline rewritten during child-friendly rewrite pass. Now reads: "find three things nearby and turn them into something you can play with."

2. ~~**Packs page shows a blank draft card** — the left pack card on `/packs` has no title, no description, just "0 playdates" and a DRAFT badge. Either hide packs with no title or clean up the Notion packs database.~~ **RESOLVED (session 23)** — blank draft pack (notion_id 30ae4ee7…) deleted from packs_cache.

3. ~~**Draft packs visible to all users** — both packs show DRAFT badges. Unless you want customers to see upcoming packs as a teaser, filter these out for non-admin users.~~ **RESOLVED (session 24)** — confirmed `getVisiblePacks()` already filters out drafts for non-collective users; DRAFT badges only render for internal/collective users. The blank draft pack (the main offender) was deleted in session 23.

### UX friction points

4. ~~**No "start here" onboarding.** A first-time user lands on the homepage, clicks "see free playdates," and gets a flat grid of 10+ cards with no guidance. Consider a short intro flow or a "recommended first playdate" callout on the sampler page.~~ **RESOLVED (sessions 23, 26)** — onboarding wizard at `/onboarding` with play context system (session 23); FirstVisitBanner and StartHereCard for first-time users (session 26).

5. ~~**Playdate cards lack visual hierarchy.** Every card looks the same — title, headline, function tags, friction dial, "find again." There's no imagery, no color differentiation, and no indicator of popularity or "great for beginners." The grid feels like a catalog rather than an invitation.~~ **RESOLVED (sessions 26, 27)** — deterministic SVG illustrations per card (Feature E), age range tags (Feature F), energy level signals with parent-friendly labels (Feature G), "great first pick" beginner badge (session 26), and "🔥 popular" badge for playdates with 5+ community tries (session 27).

6. ~~**The sampler page subtitle says "all ready playdates synced from Notion. drafts are hidden."** This reads like developer-facing copy. Change it to something user-facing like "simple playdates you can try right now — no account needed."~~ **RESOLVED (session 22)** — subtitle updated, and sampler now shows only 5 curated playdates (public view is the same for admins and visitors).

7. ~~**Collection detail pages have no "try this playdate" CTA.** The playdate cards inside a collection don't link anywhere clickable. Users see the grid but can't open a playdate detail from here (the sampler/[slug] route exists but there's no link from the collection view).~~ **RESOLVED (session 24)** — collection playdate cards link to `/sampler/${slug}`; QuickLogButton added directly on cards for one-tap "I tried this!" logging.

8. ~~**Reflections form is clean but feels disconnected.** The "linked playdate" dropdown says "none" by default. If a user just came from a playdate detail page, it should pre-select that playdate. Consider deep-linking: `/reflections/new?playdate=puddle-scientists`.~~ **RESOLVED (pre-existing)** — already implemented via `?playdate=slug` query parameter; confirmed working in session 24.

9. ~~**The playbook is the richest page but buried in the nav.** For logged-in users, this should arguably be the landing page or at least more prominent. The suggestion nudge ("you haven't explored much explore play yet — try cardboard architects →") is great, but the sentence has a grammatical hiccup (double "explore").~~ **RESOLVED (session 27)** — homepage now redirects authenticated users to `/playbook` via server-side redirect; "explore explore" grammar bug fixed in `getNextSuggestion()` with conditional handling for the explore arc.

10. ~~**Profile page is minimal.** It shows the tier cards and "manage account" — nothing else. This is a missed opportunity to surface a user's stats, badges, and recent activity. It could feel like a personal dashboard.~~ **RESOLVED (session 27)** — new `ProfileDashboard` component with stats row (runs, playdates tried, evidence, streak), badge journey progress bars, recent activity feed, and favorite collection callout. New `profile-stats.ts` query layer with parallel queries and window-function streak calculation.

---

## part 2: feature recommendations — strengthen the product

### high impact, moderate effort

**A. Playdate detail page (the missing centerpiece).** Right now, clicking a playdate card in the sampler opens `/sampler/[slug]` which shows teaser content. But from the collection view, there's no link at all. The playdate detail is where the magic happens — the 3-part guide, materials list, find-again prompts. Make sure every playdate card everywhere links to its detail page, and that the detail page has a prominent "log a reflection" CTA.

**B. Quick-start flow.** After a user signs up or first logs in, show a brief wizard: "what ages are your kids?" / "where do you usually play?" / "what do you have around?" (3 taps). Use this to pre-filter the matcher and surface a personalized "start here" playdate. This converts visitors into engaged users.

**C. Social proof / community gallery.** The evidence capture system collects photos, quotes, and observations — but only the user who captured them sees them (in their portfolio). A curated community gallery (opt-in sharing) would show potential buyers what play actually looks like. This is your best marketing asset.

**D. Email digest / nudge system.** The infrastructure for email is partially built (Resend env var is placeholder, digest cron endpoint exists). A weekly "here's what you haven't tried yet" or "it's been 2 weeks — try this 5-minute playdate" email would significantly improve retention.

### medium impact, lower effort

**E. Playdate card thumbnails / illustrations.** Even simple abstract illustrations or icons per playdate (watercolor splashes for puddle scientists, cardboard textures for cardboard architects) would make the grid dramatically more browsable. These could be static assets authored by Maria via the existing image workflow.

**F. Age range indicators.** Parents' #1 filtering question is "is this right for my kid's age?" Add an age range field to the Notion playdates database (e.g., "3-5", "5-8", "all ages") and surface it as a small tag on each card. Also add it as a filter in the matcher.

**G. Difficulty / energy level signal.** The friction dial (1-5) is the closest thing, but "friction" is designer-speak. Translate it to something parent-friendly: "chill level" (low mess, minimal setup) vs. "adventure level" (big mess, worth it). Even a simple icon (🌿 calm / ⚡ active) would help.

**H. "I did this!" quick-log button.** The reflection form is thorough but may feel heavy for a parent who just wants to check a box. Add a lightweight "mark as tried" action directly on the playdate card (one tap, no form). The full reflection can come later.

### nice-to-have, future roadmap

**I. Seasonal / themed recommendations.** "Rainy day playdates," "summer water play," "holiday crafting." These could be time-sensitive collections or a simple banner on the homepage that rotates.

**J. PDF batch export for teachers.** Teachers buying the practitioner tier would love a "download this collection as a booklet" button — all playdate cards in one PDF, formatted for printing. The PDF generation infrastructure already exists (per-playdate PDF route).

**K. Partner / co-play mode.** If two parents are on a playdate together, let them both log reflections that link to the same session. This matters for the practitioner/collective tiers targeting schools and programs.

---

## part 3: pack & collection opportunities

The current 6 collections (puddle scientists, cardboard architects, kitchen explorers, sidewalk neighbors, rhythm makers, tiny engineers) cover STEM-ish play well. Here are gaps in the portfolio that map to real buyer segments:

### new collection ideas

| Collection | Theme | Buyer angle | Playdate types |
|---|---|---|---|
| **story builders** | narrative play, character creation, world-building | literacy-focused parents, ELA teachers | puppet theaters from socks, story dice, collaborative picture books |
| **nature detectives** | outdoor observation, seasonal changes, weather | nature-school families, forest-school programs | leaf rubbings, cloud journals, bug hotels, rain gauges from bottles |
| **color lab** | color mixing, pigments, light & shadow | art teachers, Montessori programs | kitchen dye experiments, shadow puppets, color-mixing charts |
| **body movers** | gross motor, dance, spatial awareness | PE teachers, active play advocates | obstacle courses from furniture, freeze-dance games, balance challenges |
| **quiet makers** | mindful crafting, calm-down activities | parents of anxious kids, therapists | weaving with paper, mandala drawing, sensory bottles |
| **fix-it shop** | repair, deconstruction, re-purposing | sustainability-minded families | take-apart electronics, mend a stuffed animal, upcycle packaging |

### new pack ideas

Currently there's only 1 pack (co-design essentials, $49.99, DRAFT). Packs are the revenue engine — each should feel like a curated gift box of play.

| Pack | Price point | What's inside | Target buyer |
|---|---|---|---|
| **rainy day rescue** | $19 | 5 indoor playdates requiring zero prep, all household materials | parents, impulse buy |
| **classroom starter** | $39 | 8 playdates organized by 30-min class periods, printable cards, reflection templates | K-3 teachers |
| **summer play camp** | $29 | 6 outdoor-focused playdates with a weekly schedule, supply checklist | summer camp counselors, parents |
| **the whole collection** | $79 | all 20 playdates unlocked, full collection access | completionists, schools |
| **new baby sibling** | $19 | 4 playdates designed for involving a toddler alongside an older child | parents with 2+ kids |

### wish list — session 22 additions

These are feature requests captured during session 22 that should be planned into future work:

~~**L. Revisitable onboarding survey / context switching.** The 4-item playdate profile (ages, setting, materials, energy level) should not be a one-time wizard. Users need to revisit and toggle it for different contexts — at home vs. traveling, at school vs. with friends. Consider a persistent "play context" switcher in the nav or profile that re-runs the matcher filters without re-doing the full onboarding. Teachers especially may use creaseworks in school but also at home or with friends.~~ **RESOLVED (session 23)** — full play context system: migration 021 adds `play_contexts` JSONB + `active_context_name`; onboarding wizard now revisitable via `/onboarding?edit=true&context=name`; profile page has PlayContextSwitcher with switch/edit/remove/add actions; API at `/api/onboarding/context` supports POST/PATCH/DELETE; backward-compatible with `play_preferences`.

~~**M. Scavenger hunt package as a separate access point.** Campaigns (now supported via `/campaign/[slug]`) let people discover playdates through scavenger hunts. But the user wants a full *package* for scavenger hunts — a standalone access point similar to the sampler, focused exclusively on campaign scenarios. This would be a dedicated page (e.g., `/scavenger`) that aggregates all campaign-tagged playdates, provides a hunt-style navigation experience, and could be gated behind its own entitlement or shared via invite links.~~ **RESOLVED (session 23)** — `/scavenger` page built with `getAllCampaignPlaydates()` query; groups playdates by campaign tag with per-campaign metadata (emoji, title, tagline); links through to individual `/campaign/[slug]` pages.

~~**N. Complimentary subscriptions by email address.** Allow admins to grant free access to specific email addresses — colleagues, friends, schools, pilot partners. These would bypass domain verification and map to a specific entitlement tier (explorer or practitioner). Implementation could extend the existing `grantEntitlement()` function with an email-based invite system: admin enters an email → system creates a pending entitlement → recipient signs up/in with that email and gets auto-entitled. Consider a simple `/admin/invites` UI for managing these.~~ **RESOLVED (session 23)** — full invite system: migration 022 creates `invites` table with tier check constraint, expiry, soft-delete; query layer at `lib/queries/invites.ts`; API at `/api/admin/invites`; admin UI at `/admin/invites` with form (email, tier, expiry, note) and table views (pending/accepted); admin landing page updated with invites card.

### wish list — session 27 additions

~~**O. Materials illustrations.** Each material item in the database needs an image or illustration. The matcher UI may not have space to show images inline, but when a playdate references its materials (detail page, PDF export, etc.), the materials should appear with a small visual. This could be a library of simple hand-drawn-style illustrations or icons per material category (cardboard, tape, water, fabric, etc.) stored as static assets or generated SVGs.~~ **RESOLVED (session 30)** — `MaterialIllustration` component (12 form categories as deterministic SVG icons) was already integrated in web views (sampler teaser + entitled playdate detail). Session 30 added matching pdf-lib geometric icons to `drawLinkedMaterials()` in the PDF export, with category label + title layout and per-category shapes (discrete parts = scattered circles, sheets = stacked rectangles, volumes = mound, containers = cup, linear = wavy lines, etc.).

~~**P. Playdate preview images.** Each playdate tile needs a hero image that previews the activity — something visual and playful, not just a grid of words. These could collage the materials illustrations, show a stylized scene, or use AI-generated watercolor/sketch imagery. The current deterministic SVG patterns (Feature E) provide color and texture but don't communicate *what* the playdate is. The goal is to make browsing feel like flipping through a picture book rather than scanning a spreadsheet. Consider: Notion-hosted images synced via the existing sync pipeline, or generated at build time from playdate metadata.~~ **RESOLVED (session 30)** — enhanced `PlaydateIllustration` with central function icons (observe = eye, construct = stacked blocks, explore = compass/star, transform = spiral arrow, connect = linked circles, experiment = beaker/flask). Increased activity-hint motif density from 3 to 5 with larger scale and wider spread. The combination of function-specific pattern + central icon + activity hints makes each card visually communicate its activity type.

### wish list — session 29 additions

**Q–X. Wave 2 features (implemented session 29).** See session 29 accomplishments below.

~~**Y. Visual architecture for non-readers.** We want children to be able to use creaseworks, so we need to find a visual architecture to help non-readers semi-navigate the app. This means: icon-based navigation, color-coded sections, illustration-heavy UI cues, and minimal reliance on text labels for core actions (try, log, explore). Consider a "kid mode" toggle or an always-visual nav layer that supplements the current text-based interface. Research: Montessori color coding, PBS Kids navigation patterns, Toca Boca UI, Duolingo ABC.~~ **RESOLVED (session 30)** — NavBar updated with inline SVG icons for every nav destination (playdates = clock, matcher = overlapping circles, packs = suitcase, reflections = journal with checkmark, playbook = open book, profile = person silhouette, admin = star). Section colour map gives each destination a distinct accent colour. New mobile bottom tab bar with icon + short label (play, match, book, log, me) using `usePathname()` for active state highlighting and safe-area-inset-bottom padding. Icons supplement text labels throughout for always-visual navigation.

### session 22 accomplishments

*February 25–26, 2026*

- **Sampler reduced to 5 curated playdates** — moved 19 playdates from `release_channel = 'sampler'` to `'internal-only'`. The 5 remaining (shadow-tracker, cloud-cartographer, leaf-press-telegraph, function-tag-scavenger, kek-loop-micro-experience) are all `ip_tier = 'standard'` so the design methodology stays protected.
- **Admin playdates page** — new route at `/admin/playdates` shows the full catalog grouped by release channel (sampler, campaign, internal-only) with count badges. Admins no longer see everything on the public sampler.
- **Sampler page fixed** — removed the `isInternal` bypass so admins see the same public view as visitors. Updated subtitle to user-facing copy. Always shows "start here" recommendation block.
- **Campaign system built** — migration 020 adds `campaign_tags TEXT[]` column with GIN index. New `getCampaignPlaydates()` query function. New `/campaign/[slug]` public landing page with per-campaign metadata.
- **Acetate campaign launched** — 3 playdates tagged with `'acetate'`: acetate-color-mixer, colored-shadow-puppets, kitchen-dye-spectrum. Live at `/campaign/acetate`.
- **Child-friendly rewrite** — all 30 playdate headlines, find & unfold text, and related copy rewritten for parent/child audience (completed earlier in session).
- **Function-tag-scavenger headline fixed** — no longer triple-repeated; now reads "find three things nearby and turn them into something you can play with."

---

## part 4: codebase audit summary

The codebase is clean for a 20-session project. 144 source files, 53 tests passing, consistent naming conventions, no TODO/FIXME/HACK comments, proper error handling throughout.

### actionable findings

**Priority: medium**

- ~~**5 large files should be split.** `matcher-input-form.tsx` (712 lines), `run-form.tsx` (525), `pdf/route.ts` (606), `queries/runs.ts` (513), `queries/matcher.ts` (512). Extract sub-components and scoring logic into separate files.~~ **RESOLVED (session 26)** — all 5 files split into directory modules with backward-compatible re-exports.

- ~~**Sync module duplication.** All 5 sync handlers (materials, playdates, runs, collections, packs) share ~40% identical structure. Extract a generic `syncCacheTable()` utility.~~ **RESOLVED (session 25)** — new `sync-cache-table.ts` with generic `syncCacheTable<T>()` orchestrator; all 5 handlers refactored to use it.

**Priority: low**

- ~~**9 instances of `any` types** could be stronger. The Notion API responses (`page: any` in sync modules) and component props (`playdate: any` in entitled-playdate-view) would benefit from typed interfaces.~~ **RESOLVED (session 25)** — added proper interfaces (`Pack`, `TeaserPlaydate`, `PlaydateRow`, `Material`, `CampaignPlaydate`, etc.) to 10 page files; imported `RunRow` and `CollectionPlaydate` from query layer.

- ~~**API route error handling boilerplate.** 15+ routes have identical `try { await req.json() } catch` blocks. A shared `parseJsonBody()` helper would reduce repetition.~~ **RESOLVED (session 25)** — `parseJsonBody<T>()` added to `lib/validation.ts`; applied to 10 API route files (15+ handler functions).

**No issues found:**

- All dynamic routes correctly use Next.js 15+ async params pattern ✓
- Console statements are appropriately scoped to server-side logging ✓
- Environment variables are properly externalized ✓
- No hardcoded secrets or credentials in source ✓
- No dead code or unused imports detected ✓

---

## recommended next session priorities

*Updated session 26*

1. ~~**Fix the data issues** — clean up "function tag scavenger" headline in Notion, hide or delete the blank draft pack~~ **DONE** (headline fixed session 22; blank pack deleted from DB session 23)
2. ~~**Wire playdate card links in collection views** — make cards clickable through to the detail page~~ **DONE** (already wired via `href` prop in session 23)
3. ~~**Add the quick-log "mark as tried" button** — lowest-friction way to build engagement~~ **DONE (session 24)** — `PlaydateCard` now accepts an `action` ReactNode slot via `CardActionSlot` client wrapper; collection detail page passes `QuickLogButton` into each card
4. ~~**Pre-select linked playdate in reflection form** via query param~~ **DONE** (already implemented via `?playdate=slug` param)
5. ~~**Author 2-3 new collections in Notion** — start with story builders and nature detectives to broaden the portfolio~~ **DONE (session 24-25)** — 6 new collections created: story builders, nature detectives, color lab, body movers, quiet makers, fix-it shop (12 total)
6. ~~**Create and publish the "rainy day rescue" pack** — a $19 entry-point pack to validate the purchase flow end-to-end~~ **DONE (session 24-25)** — rainy day rescue pack created in Notion with 5 indoor zero-prep playdates, status: ready
7. ~~**Build the scavenger hunt package page** — dedicated `/scavenger` access point aggregating all campaign-tagged playdates (wish list item M)~~ **DONE (session 23)**
8. ~~**Implement revisitable onboarding / play context switcher** — let users toggle their playdate profile for different settings (wish list item L)~~ **DONE (session 23)**
9. ~~**Build complimentary invite system** — `/admin/invites` for granting email-based entitlements (wish list item N)~~ **DONE (session 23)**
10. ~~**Update Notion release_channel values** — the 19 playdates moved to `internal-only` in Postgres need their Notion records updated so future syncs don't overwrite the change~~ **DONE (session 23)** — all 19 playdates updated in Notion to match Postgres values

### session 23 accomplishments

*February 26, 2026*

- **Notion release_channel sync** — updated all 19 playdates in Notion whose `release_channel` had been changed in Postgres (sampler → internal-only) so future syncs won't overwrite the values.
- **Revisitable onboarding with play context switching** — migration 021 adds `play_contexts` JSONB array and `active_context_name` to users table with backward migration from existing `play_preferences`. Onboarding wizard now supports `?edit=true&context=name` for revisiting. New `/api/onboarding/context` API (POST/PATCH/DELETE) for creating, switching, and removing contexts. Profile page has new PlayContextSwitcher component with switch/edit/remove/add actions. Maintains backward compatibility by syncing `play_preferences` with active context.
- **Scavenger hunt package page** — new `/scavenger` route aggregates all campaign-tagged playdates grouped by campaign, with per-campaign metadata (emoji, title, tagline) and links through to individual `/campaign/[slug]` pages. New `getAllCampaignPlaydates()` query function.
- **Complimentary invite system** — migration 022 creates `invites` table with tier constraint, expiry, soft-delete, and acceptance tracking. Full query layer (`createInvite`, `listAllInvites`, `getPendingInvitesForEmail`, `acceptInvite`, `revokeInvite`). API at `/api/admin/invites` (POST/GET/DELETE). Admin UI at `/admin/invites` with form (email, tier, expiry selector, note) and table views split by status. Admin landing page updated with invites navigation card.
- **Blank draft pack cleanup** — deleted the orphaned blank draft pack (no title, no slug, status=draft) from `packs_cache`.

### session 24 accomplishments

*February 26, 2026*

- **Quick-log button on playdate cards** — `PlaydateCard` now accepts an `action?: ReactNode` prop for embedding interactive elements. New `CardActionSlot` client wrapper component handles click/key propagation so buttons inside the card don't trigger the parent `<Link>` navigation. Collection detail page (`playbook/[slug]`) passes `QuickLogButton` into each card, giving users one-tap "I tried this!" logging without leaving the collection view.
- **Confirmed existing implementations** — verified that collection playdate cards already link through to `/sampler/${slug}` detail pages (item #2), reflection form already supports `?playdate=slug` pre-selection (item #4), and draft pack visibility is already properly gated behind `getVisiblePacks()` for non-collective users (item #3).

### session 25 accomplishments

*February 26, 2026*

- **parseJsonBody() utility** — generic `parseJsonBody<T>()` helper added to `lib/validation.ts` returning `T | NextResponse`. Applied to 10 API route files (runs, evidence, admin/entitlements, admin/domains, team/members, team/domains, evidence/upload-url, matcher, checkout), eliminating 15+ identical try/catch blocks. Pattern: `const body = await parseJsonBody(req); if (body instanceof NextResponse) return body;`
- **TypeScript `any` type cleanup** — added proper interfaces to 10 page files. Inline types: `Pack`, `TeaserPlaydate`, `PlaydateTeaser`, `PlaydateFull`, `PlaydateCollective`, `Material`, `Playdate`, `CampaignPlaydate`. Imported existing types: `RunRow` from `queries/runs`, `CollectionPlaydate` from `queries/collections`.
- **syncCacheTable() generic utility** — new `sync-cache-table.ts` extracts the shared 4-step orchestration (fetch pages → parse & upsert → cleanup stale → resolve relations) into a typed generic. All 5 sync handlers (materials, playdates, packs, collections, runs) refactored to delegate to `syncCacheTable()` with handler-specific callbacks. Eliminates ~40% duplicated structure.
- **Notion content: 6 new collections live** — story builders, nature detectives, color lab, body movers, quiet makers, fix-it shop. Total: 12 collections with playdates assigned.
- **Notion content: rainy day rescue pack** — 5 indoor zero-prep playdates, status: ready. First entry-point pack at $19.
- **All code audit findings resolved** — every actionable item from Part 4 (sync duplication, `any` types, API boilerplate) is now addressed. Remaining item: split 5 large files (712/525/606/513/512 lines).

### session 26 accomplishments

*February 26, 2026*

- **5 large file splits completed** — all Part 4 code cleanup done. `matcher-input-form.tsx` (712 lines) → `src/components/matcher/` (6 files: types, filter-section, pill, use-matcher-state hook, matcher-results, main component). `run-form.tsx` (525 lines) → `src/components/ui/run-form/` (6 files: types, use-run-form-state hook, essentials, optional fields, actions, main component). `pdf/route.ts` (606 lines) → `src/app/api/playdates/[playdateId]/pdf/` (6 files: types, constants, utils, sections, pdf-generator, route). `queries/runs.ts` (513 lines) → `src/lib/queries/runs/` (6 files: types, list, detail, mutations, export, picker + index.ts re-exports). `queries/matcher.ts` (512 lines) → `src/lib/queries/matcher/` (6 files: types, picker, candidate-cache, scoring, orchestrator + index.ts re-exports). All backward-compatible via re-export indexes.
- **Feature A: Playdate detail links audit** — verified all card surfaces already properly linked to `/sampler/[slug]`. No changes needed.
- **Feature B: First-visit onboarding** — `FirstVisitBanner` component (dismissible, CTA to /onboarding) shown on playbook page when user has no play contexts. `StartHereCard` badge wrapper highlights shadow-tracker for new users on sampler page.
- **Feature C: Community gallery** — migration 024 adds `shared_to_gallery`, `gallery_approved`, `gallery_shared_at` columns to `run_evidence` with partial indexes. Full query layer (`gallery.ts`, 10 functions). API routes for public feed, share toggle, and admin moderation. Public gallery page at `/gallery` with masonry grid. Admin moderation at `/admin/gallery`.
- **Feature D: Email digest / nudge system** — migration 025 adds biweekly digest option, `nudge_enabled`, `last_nudge_sent_at`, and `last_active_at` tracking. Nudge email template via Resend. Daily cron at `/api/cron/send-nudges` (08:00 UTC). Enhanced notification preferences UI with digest + nudge sections.
- **Feature E: Playdate card thumbnails** — `PlaydateIllustration` component generates deterministic SVG patterns from playdate slug hash, mapped to function tags (observe→circles, construct→blocks, explore→waves, imagine→stars, move→zigzags, etc.). Integrated into every `PlaydateCard`.
- **Feature F: Age range indicators** — migration 023 adds `age_range` and `energy_level` columns to `playdates_cache`. Sync handler extracts from Notion. Cards display age range tags.
- **Feature G: Energy level signal** — friction dial translated to parent-friendly labels: 1-2 → "calm" 🌿, 3 → "moderate" 🌤️, 4-5 → "active" ⚡. Matcher accepts `energyLevels` filter parameter.
- **Feature I: Seasonal recommendations** — `src/lib/seasonal.ts` utility (season detection + tag mapping), `src/lib/queries/seasonal.ts` (array overlap queries), `SeasonalBanner` server component on playbook page, `/api/seasonal` public endpoint. Winter shows ❄️ cozy indoor picks, spring shows 🌱 outdoor garden activities, etc.
- **Feature J: PDF batch export** — `/api/collections/[slug]/pdf` generates multi-page booklets with cover page, table of contents, and individual playdate pages. Reuses existing pdf-lib infrastructure. `CollectionExportButton` client component on collection detail pages.
- **Feature K: Co-play mode** — migration 026 adds `co_play_invite_code`, `co_play_parent_id`, `co_play_reflections` JSONB to `runs_cache`. Full query layer with invite code generation, join flow, and reflection storage. API routes for enabling co-play, joining, and submitting reflections. Public join page at `/co-play/[code]`, reflection form, and `CoPlayInvite` component for run detail views.
- **4 new packs in Notion** — classroom starter ($39, 8 playdates for K-3 teachers), summer play camp ($29, 6 outdoor playdates), the whole collection ($79, all 20 playdates), new baby sibling ($19, 4 sibling-friendly playdates).
- **Migrations 023–026 live** — all four executed successfully in Neon production.
- **Source files: 189 → 223** — net +34 files from feature additions and file splits.
- **All Part 2 recommendations (A–K) resolved.** Every feature from the original review is now implemented. All Part 4 code audit items complete.

### session 27 accomplishments

*February 26, 2026*

- **Memory system for cross-session persistence** — created `memory/projects/creaseworks.md` with machine-readable project state (DB IDs, migration log, feature status, architecture, session-start checklist). Updated `CLAUDE.md` with session memory pointers. This ensures critical state survives context compaction.
- **Item 9: Playbook as default landing** — homepage (`src/app/page.tsx`) now server-side redirects authenticated users to `/playbook`. Fixed "explore explore" grammar bug in `getNextSuggestion()` (`src/lib/queries/collections.ts`) with conditional handling for the explore arc.
- **Item 10: Profile dashboard** — new `ProfileDashboard` server component (`src/components/profile-dashboard.tsx`) with 4 sections: stats row (total runs, playdates tried, evidence captured, current streak), badge journey (progress bars per badge level), recent activity feed, and favorite collection callout. New `profile-stats.ts` query layer using parallel `Promise.all()` and window functions for streak calculation. Integrated into profile page above tier cards.
- **Review doc fully resolved** — all 10 UX friction points in Part 1 now marked with resolution status. All Part 2 features (A–K), Part 3 wish list items (L–N), and Part 4 code audit items complete. Only remaining open item: popularity/beginner signals on cards (Item 5, partially resolved).

### session 29 accomplishments

*February 27, 2026*

- **Feature Q: Stripe price_id support** — `packs_catalogue.stripe_price_id` column now queried in checkout route. `createCheckoutSession()` conditionally uses `{ price: stripePriceId }` when a pre-created Stripe price exists, falling back to inline `price_data` for ad-hoc pricing. Eliminates duplicate product creation in Stripe dashboard.
- **Feature T: Playdate peek cards** — new `PlaydatePeek` client component (`src/components/playdate-peek.tsx`) with expandable accordion for non-entitled pack teaser view. Shows title, function tag, find-again badge, age range, and energy level emoji (🧘 calm / ⚡ moderate / 🔥 active). Integrated into `packs/[slug]/page.tsx` replacing flat `<li>` teasers. `energy_level` added to `PLAYDATE_TEASER_COLUMNS` in column-selectors.ts.
- **Feature U: Gallery approval email** — new `sendGalleryApprovedEmail()` in `src/lib/email/send-gallery-approved.ts` sends branded HTML notification via Resend when admin approves gallery evidence. Fire-and-forget call added to `approveGalleryItem()` in gallery.ts.
- **Feature V: Campaign DB lookup** — migration 027 creates `campaigns` table (slug, title, description, active, timestamps) with acetate seed. New query layer at `src/lib/queries/campaigns.ts` (getAllCampaigns with playdate_count, getCampaignBySlug, CRUD operations). Campaign detail page (`campaign/[slug]/page.tsx`) now fetches metadata from DB instead of hardcoded `CAMPAIGNS` constant. Admin UI at `/admin/campaigns` with form, table, and toggle/delete actions. API at `/api/admin/campaigns` (GET/POST/PUT/DELETE).
- **Feature W: Pack finder wizard** — new `PackFinder` client component (`src/components/pack-finder.tsx`) with 3-question guided selector (setting → age range → goals) mapping situations to pack slugs. Includes comparison table toggle showing per-playdate pricing. Integrated above pack grid on `/packs`.
- **Feature X: Playbook search/filter** — new `PlaybookSearch` client component (`src/components/playbook-search.tsx`) with text search input + progress-based filter chips (all, not tried, in progress, completed). Uses `useMemo` for filtered results, renders `CollectionCard` grid. Integrated into playbook page replacing static grid.
- **10 new files, 11 existing files modified** — total of 21 file changes across features Q–X.
- **Non-reader visual architecture** — added wish list item Y for child-friendly navigation (icon-based nav, color-coded sections, illustration-heavy UI cues, kid mode toggle).

### session 30 accomplishments

*February 27, 2026*

- **Feature O: PDF material icons** — `drawLinkedMaterials()` in `sections.ts` now renders a 14×14 geometric icon per material category using pdf-lib primitives (drawCircle, drawRectangle, drawEllipse, drawLine). All 12 form categories from `MaterialIllustration` (web component) replicated as PDF shapes: discrete small parts, sheet goods, volumes, containers, linear/filament, wearables, found objects, mark-making, joining/fastening, overlay, cutting, modules. Each material row shows icon + category label + title (was plain text only). Added `SIENNA` colour constant to PDF palette.
- **Feature P: Playdate preview composites** — enhanced `PlaydateIllustration` with central function icons that communicate activity type at a glance: observe = eye, construct = stacked blocks, explore = compass/star, transform = spiral arrow, connect = linked circles, experiment = beaker/flask. Activity-hint motif density increased from 3→5 with larger scale (1.4–2.2×) and wider placement spread. The layered composition (base pattern + function icon + activity hints) makes each card visually distinct and browsable.
- **Feature Y: Non-reader visual architecture** — NavBar updated with 7 inline SVG icons (20×20 viewBox) alongside text labels. Per-section colour mapping via `SECTION_COLORS` constant. New mobile bottom tab bar (`<nav aria-label="quick navigation">`) with icon + short label (play/match/book/log/me for authed, play/match/packs for public). Active state uses `usePathname()` with accent colour highlight and subtle background. Safe-area-inset-bottom padding for iOS home indicator. All review wish list items (O, P, Y) resolved.
- **3 files modified** — `pdf/sections.ts` (material icons + SIENNA import), `pdf/constants.ts` (SIENNA colour), `playdate-illustration.tsx` (function icons + motif density), `nav-bar.tsx` (icons + bottom tab bar).

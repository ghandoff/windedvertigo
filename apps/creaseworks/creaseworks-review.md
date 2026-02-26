# creaseworks — experience review & recommendations

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

4. **No "start here" onboarding.** A first-time user lands on the homepage, clicks "see free playdates," and gets a flat grid of 10+ cards with no guidance. Consider a short intro flow or a "recommended first playdate" callout on the sampler page.

5. **Playdate cards lack visual hierarchy.** Every card looks the same — title, headline, function tags, friction dial, "find again." There's no imagery, no color differentiation, and no indicator of popularity or "great for beginners." The grid feels like a catalog rather than an invitation.

6. ~~**The sampler page subtitle says "all ready playdates synced from Notion. drafts are hidden."** This reads like developer-facing copy. Change it to something user-facing like "simple playdates you can try right now — no account needed."~~ **RESOLVED (session 22)** — subtitle updated, and sampler now shows only 5 curated playdates (public view is the same for admins and visitors).

7. **Collection detail pages have no "try this playdate" CTA.** The playdate cards inside a collection don't link anywhere clickable. Users see the grid but can't open a playdate detail from here (the sampler/[slug] route exists but there's no link from the collection view).

8. **Reflections form is clean but feels disconnected.** The "linked playdate" dropdown says "none" by default. If a user just came from a playdate detail page, it should pre-select that playdate. Consider deep-linking: `/reflections/new?playdate=puddle-scientists`.

9. **The playbook is the richest page but buried in the nav.** For logged-in users, this should arguably be the landing page or at least more prominent. The suggestion nudge ("you haven't explored much explore play yet — try cardboard architects →") is great, but the sentence has a grammatical hiccup (double "explore").

10. **Profile page is minimal.** It shows the tier cards and "manage account" — nothing else. This is a missed opportunity to surface a user's stats, badges, and recent activity. It could feel like a personal dashboard.

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

- **5 large files should be split.** `matcher-input-form.tsx` (712 lines), `run-form.tsx` (525), `pdf/route.ts` (606), `queries/runs.ts` (513), `queries/matcher.ts` (512). Extract sub-components and scoring logic into separate files.

- **Sync module duplication.** All 5 sync handlers (materials, playdates, runs, collections, packs) share ~40% identical structure. Extract a generic `syncCacheTable()` utility.

**Priority: low**

- **9 instances of `any` types** could be stronger. The Notion API responses (`page: any` in sync modules) and component props (`playdate: any` in entitled-playdate-view) would benefit from typed interfaces.

- **API route error handling boilerplate.** 15+ routes have identical `try { await req.json() } catch` blocks. A shared `parseJsonBody()` helper would reduce repetition.

**No issues found:**

- All dynamic routes correctly use Next.js 15+ async params pattern ✓
- Console statements are appropriately scoped to server-side logging ✓
- Environment variables are properly externalized ✓
- No hardcoded secrets or credentials in source ✓
- No dead code or unused imports detected ✓

---

## recommended next session priorities

*Updated session 24*

1. ~~**Fix the data issues** — clean up "function tag scavenger" headline in Notion, hide or delete the blank draft pack~~ **DONE** (headline fixed session 22; blank pack deleted from DB session 23)
2. ~~**Wire playdate card links in collection views** — make cards clickable through to the detail page~~ **DONE** (already wired via `href` prop in session 23)
3. ~~**Add the quick-log "mark as tried" button** — lowest-friction way to build engagement~~ **DONE (session 24)** — `PlaydateCard` now accepts an `action` ReactNode slot via `CardActionSlot` client wrapper; collection detail page passes `QuickLogButton` into each card
4. ~~**Pre-select linked playdate in reflection form** via query param~~ **DONE** (already implemented via `?playdate=slug` param)
5. **Author 2-3 new collections in Notion** — start with story builders and nature detectives to broaden the portfolio
6. **Create and publish the "rainy day rescue" pack** — a $19 entry-point pack to validate the purchase flow end-to-end
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

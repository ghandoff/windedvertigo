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

1. **"function tag scavenger" has a broken headline** — the text "find objects. name functions. make play." repeats 3 times in the headline field. This is a Notion data issue, not a code bug. Fix it in the Notion playdates database.

2. **Packs page shows a blank draft card** — the left pack card on `/packs` has no title, no description, just "0 playdates" and a DRAFT badge. Either hide packs with no title or clean up the Notion packs database.

3. **Draft packs visible to all users** — both packs show DRAFT badges. Unless you want customers to see upcoming packs as a teaser, filter these out for non-admin users.

### UX friction points

4. **No "start here" onboarding.** A first-time user lands on the homepage, clicks "see free playdates," and gets a flat grid of 10+ cards with no guidance. Consider a short intro flow or a "recommended first playdate" callout on the sampler page.

5. **Playdate cards lack visual hierarchy.** Every card looks the same — title, headline, function tags, friction dial, "find again." There's no imagery, no color differentiation, and no indicator of popularity or "great for beginners." The grid feels like a catalog rather than an invitation.

6. **The sampler page subtitle says "all ready playdates synced from Notion. drafts are hidden."** This reads like developer-facing copy. Change it to something user-facing like "simple playdates you can try right now — no account needed."

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

1. **Fix the data issues** — clean up "function tag scavenger" headline in Notion, hide or delete the blank draft pack
2. **Wire playdate card links in collection views** — make cards clickable through to the detail page
3. **Add the quick-log "mark as tried" button** — lowest-friction way to build engagement
4. **Pre-select linked playdate in reflection form** via query param
5. **Author 2-3 new collections in Notion** — start with story builders and nature detectives to broaden the portfolio
6. **Create and publish the "rainy day rescue" pack** — a $19 entry-point pack to validate the purchase flow end-to-end

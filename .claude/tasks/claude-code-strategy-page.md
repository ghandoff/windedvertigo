# opus prompt: build the port strategy page

> paste this into claude code at the windedvertigo monorepo root.
> this is a two-phase build. phase 1 must be deployed by tuesday 8am PT (may 5).

---

## context

winded.vertigo is a learning design collective. our CRM lives at `port.windedvertigo.com` (Next.js 16, Tailwind v4, shadcn/ui, Supabase, Auth.js v5, deployed on CF Workers as `wv-port`). the full monorepo is this repo — port lives at `port/`.

the CMO role for w.v is run by claude (AI). the CMO has produced a comprehensive marketing strategy for Q2–Q3 2026, including audience segments, channel strategy, competitive positioning, content calendar, revenue alignment, design tool integration, and a delegation matrix for the team. all of this lives in `.brain/memory/marketing/`:

```
.brain/memory/marketing/
├── strategy-2026-q2q3.md        # 813 lines — full marketing strategy
├── audience-segments.md          # 6 audience personas with pain points + product mapping
├── channels.md                   # channel-by-channel playbook (linkedin, IG, substack, email, conferences, outreach)
├── content-calendar-framework.md # recurring weekly/monthly content rhythm + repurposing pipeline
├── competitive-positioning.md    # w.v differentiation + positioning statement
├── revenue-marketing-alignment.md# pipeline math, MQL definition, weekly KPIs, the $500k math
├── design-tools-integration.md   # claude design + adobe + canva + port CRM workflow
├── harbour-launch-plan.md        # harbour launch moved to 28 may (aligned with PPCS finale)
├── brand-voice.md                # verbal identity, colourways, typography, tone calibration
├── proposals.md                  # proposal generation doctrine + team composition rules
├── weekly-cmo-log.md             # CMO review log entries
```

garrett needs to present this strategy to lamis, maria, and payton at the tuesday 8am PT strategy playdate. markdown files won't work — the team needs an interactive, digestible interface.

## what to build

### phase 1 — "strategy command centre" (due tuesday 8am PT)

add a new page to port at `/strategy`. this is an interactive strategy presentation page that makes the 8 CMO scaffolding documents digestible and actionable for the team.

#### navigation

add "strategy" to the **outreach** section in `port/app/components/nav-config.ts`:

```ts
// in the "outreach" section items array, add:
{ label: "strategy", href: "/strategy", icon: Compass },
```

you'll need to move `Compass` from BOTTOM_ITEMS to the outreach section, or use a different icon like `Map` or `Rocket` from lucide-react. pick what feels right — just don't break the docent bottom item.

#### page structure

create `port/app/(dashboard)/strategy/page.tsx`. the page should have:

**1. hero / executive summary card** — a prominent card at the top with:
- the revenue target: **$500,000 by september 2026**
- current cash: ~$34k, 4-month runway
- pipeline math: 10 contracts × $50k avg = 2/month, 5 proposals/month, 30 outreach touches/week
- three strategy layers: immediate activation (may) → amplification (june-july) → scaling (aug-sept)
- this should feel urgent but confident — the CMO telling the truth with a plan

**2. tabbed content sections** — use the existing `UrlTabs` component pattern from campaigns page (`port/app/components/url-tabs.tsx`). tabs:

- **strategy** — the executive summary + market positioning + revenue plan from `strategy-2026-q2q3.md`. not the full 813 lines — distill to key sections with expandable detail.
- **campaigns** — the 6 campaign architectures from the strategy doc: PPCS→harbour funnel, harbour launch, conference injection, warm network, content engine, cold outreach refresh. each as a card with timeline, owner, KPIs, status. NOTE: harbour launch is now 4–6 curated apps (not all 19). remaining apps are "coming soon". the strategy page should reflect this narrowed scope. also note cold outreach is being pivoted to conference campaign + one-pagers (low engagement on initial cold emails).
- **channels** — visual channel overview from `channels.md`. for each channel: purpose, cadence, owner, target KPIs. use a card grid.
- **audience** — the 6 personas from `audience-segments.md` as cards: who they are, pain points, which products map, where they engage.
- **pipeline** — the revenue-marketing alignment from `revenue-marketing-alignment.md`. pipeline funnel visualisation (awareness → engagement → conversation → proposal → contract), the weekly KPI targets, the math.
- **delegation** — the project delegation matrix. 12 projects with owner, support, next action, deadline. filterable by team member.
- **timeline** — a visual campaign roadmap (gantt-style) showing all 6 campaigns plotted across may–september. this is the centrepiece visual — see detailed spec below.

**3. team pulse strip** — below the hero, a horizontal strip showing each team member and their assigned projects/campaigns. click a member to filter the whole page to their responsibilities.

#### design

- follow existing port design language: dark sidebar (`bg-sidebar`), light content area, shadcn/ui components, lowercase text throughout
- use the w.v brand colours defined in the codebase (navy #273248, redwood #b15043, sienna #cb7858, champagne #ffebd2, teal #43b187, periwinkle #5872cb, lavender #d5d2ff)
- cards should use the existing `Card, CardContent, CardHeader, CardTitle` from shadcn/ui
- the page should feel like a professional marketing dashboard, not a document dump
- responsive — works on mobile for garrett presenting from his phone if needed

#### data source

for phase 1, the content is **static** — hardcoded from the markdown files. read each file in `.brain/memory/marketing/` and extract the key data into structured TypeScript constants or a JSON file. this is intentional: we want a working interface by tuesday, not a database migration.

suggested approach:
- create `port/lib/strategy-data.ts` with all the structured content
- the page components read from this file
- phase 2 will migrate this to supabase

#### components to create

```
port/app/(dashboard)/strategy/
├── page.tsx                    # main page with tabs
├── strategy-hero.tsx           # executive summary hero card
├── team-pulse-strip.tsx        # horizontal team member filter
├── campaign-cards.tsx          # campaign architecture cards
├── channel-overview.tsx        # channel strategy grid
├── audience-personas.tsx       # audience segment cards
├── pipeline-funnel.tsx         # visual funnel + KPIs
├── delegation-matrix.tsx       # project delegation table/grid
└── timeline-view.tsx           # 90-day roadmap visualisation
```

plus: `port/lib/strategy-data.ts` for all content.

#### visual campaign roadmap (timeline tab) — critical asset

the timeline tab is NOT a simple list or text timeline. it's a **visual gantt-style roadmap** that shows all 6 campaigns as coloured horizontal bars plotted across a may–september time axis. this is the signature visual of the strategy page — the thing the team screenshots and refers back to.

**layout:**
- horizontal time axis across the top: months (may, jun, jul, aug, sep) with week gridlines
- vertical list of campaigns, each with a coloured bar spanning its active period
- a "today" marker (vertical dashed line in redwood/red) showing current position
- milestone diamonds (◆) at key dates within each campaign bar
- subtle week gridlines for orientation

**campaigns and their timelines:**

| campaign | colour | start | end | milestones |
|----------|--------|-------|-----|------------|
| PPCS → harbour funnel | teal #43b187 | may 1 | jun 15 | may 28: harbour launch, jun 1: first cohort |
| harbour launch | periwinkle #5872cb | may 15 | jul 15 | may 28: soft launch, jun 15: public, jul 1: first retention data |
| conference injection | sienna #cb7858 | may 1 | sep 30 | jun: ISTE, jul: learning impact, aug: devlearn |
| warm network activation | redwood #b15043 | may 1 | jun 30 | may 15: first round, jun 1: follow-up round |
| content engine | lavender #d5d2ff | may 1 | sep 30 | may: establish rhythm, jun: first viral target, aug: 1000 subscribers |
| cold outreach refresh | champagne #ffebd2 (dark text) | jun 1 | sep 30 | jun 15: new messaging live, jul: A/B results, aug: scale |

**design details:**
- each campaign bar is a rounded rectangle (~20px tall) with the campaign colour
- campaign label to the left of the bar (or inside if bar is wide enough)
- milestone diamonds are small (8px) solid-fill markers positioned on the bar
- hover/click a campaign to see details (or expand below)
- the today marker is a vertical line spanning the full height with a small label "today" or the date
- the overall background is white/light (`bg-card`) with subtle gridlines in `border-muted`
- make it responsive: on mobile, the campaigns stack vertically with a simplified horizontal bar per campaign

**implementation:**
- build this as a react component (`timeline-view.tsx`) using pure CSS/tailwind for the bars — no external charting library needed
- calculate bar positions as percentages: total range = may 1 to sep 30 (153 days). each campaign's start/end maps to a left% and width%
- the today marker position = (today - may 1) / 153 days as a percentage
- store campaign timeline data in `strategy-data.ts`

**example structure:**
```tsx
// timeline-view.tsx
const TIMELINE_START = new Date('2026-05-01')
const TIMELINE_END = new Date('2026-09-30')
const TOTAL_DAYS = 153

function dayToPercent(date: Date) {
  const diff = (date.getTime() - TIMELINE_START.getTime()) / (1000 * 60 * 60 * 24)
  return (diff / TOTAL_DAYS) * 100
}
```

this visual is essential — if you have to cut something else to make time for this, cut the pipeline-funnel before cutting this. the roadmap is what makes the strategy tangible for the team.

#### key architectural decisions

- use server components where possible (this is mostly static content for phase 1)
- the `page.tsx` can be a server component that imports client components for interactive parts (tabs, filters, expandable sections)
- revalidate = 0 for now (content changes with each deploy, not at runtime)
- use the same component patterns as the existing campaigns page — look at how `CampaignKanban`, `CampaignStatsStrip`, etc. are structured

### phase 2 — "living strategy system" (build tonight or next session)

phase 2 transforms the static strategy page into a living system connected to port's data layer. before building, research how these platforms handle CMO/marketing strategy interfaces:

**platforms to study:**
- **HubSpot** marketing hub — how they structure campaign reporting, content calendar, and marketing KPIs in a single dashboard
- **Salesforce Marketing Cloud** — how they connect campaign execution to pipeline reporting and revenue attribution
- **monday.com marketing** — how they handle marketing project management with status tracking and team assignments
- **Notion** marketing templates — how teams structure OKRs, content calendars, and campaign trackers
- **Clay** — how they handle outreach automation and pipeline enrichment with AI
- **Attio** — how they do relationship-driven CRM with AI-first workflows
- **Jasper** — how they handle AI-driven marketing strategy and content generation at scale

**what to look for specifically:**
- how do these platforms present marketing strategy alongside execution data?
- how do they handle the gap between "strategy document" and "daily campaign management"?
- how do they integrate AI as a strategic advisor (not just content generator)?
- what does a "marketing command centre" look like when the CMO is an AI?

**phase 2 features:**
1. **supabase tables** for strategy data — campaigns, KPIs, team assignments, timeline milestones. allow the CMO (claude) to update these via the wv-claw agent or scheduled tasks.
2. **live KPI dashboard** — pull real metrics: email sends (resend), social engagement (manual entry or API), pipeline value (from port opportunities), contracts signed.
3. **content calendar** — connected to the existing `/content` page. visualise the weekly rhythm from `content-calendar-framework.md`.
4. **campaign lifecycle** — connect strategy campaigns to existing `/campaigns` in port. each strategy campaign maps to one or more port campaigns.
5. **weekly CMO review integration** — the automated wednesday CMO review (`weekly-cmo-review` scheduled task) writes its findings directly to the strategy page.
6. **team accountability** — each team member sees their assignments, deadlines, and completion status. updated via slack or port directly.
7. **AI strategy chat** — an AI chat panel (like the existing ai-hub) scoped to marketing strategy. asks "how are we tracking against the $500k target?" and gets a real answer from live data.

## technical notes

- port runs on CF Workers via OpenNext. deploy with: `cd port && npx wrangler deploy` (or use the existing deploy scripts).
- supabase project is already wired up (`port/lib/supabase/`). check existing patterns.
- the sidebar nav config is at `port/app/components/nav-config.ts`.
- existing component patterns to follow: look at `campaigns/page.tsx` for tab structure, `analytics/page.tsx` for dashboard cards, `projects/page.tsx` for kanban/list views.
- use `@/components/ui/*` for shadcn components (Card, Badge, Tabs, etc.).
- all text lowercase per w.v brand voice.

## deployment

after building phase 1:
1. test locally: `cd port && npm run dev`
2. build: `npm run build` (in port directory)
3. deploy: use the wv-port CF Workers deploy process

the page needs to be live at `port.windedvertigo.com/strategy` before tuesday 8am PT.

## priority

phase 1 is the hard deadline. if you run out of time, cut the pipeline-funnel — the team can read those numbers. the must-haves are: hero card, campaign cards, channel overview, audience personas, delegation matrix, AND the visual campaign roadmap (timeline tab). the roadmap is the signature visual — the thing that makes the whole strategy tangible at a glance. garrett needs to walk the team through it as the centrepiece of the presentation.

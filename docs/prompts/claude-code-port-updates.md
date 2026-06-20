# claude code prompts: port updates (post-strategy playdate)

> garrett: give these to claude code one at a time, or paste the whole file and say "work through these in order."
> context: the strategy playdate happened may 5. team gave feedback. these are the resulting engineering tasks.

---

## prompt 1: pipeline funnel progress bars

the strategy page at `port/app/(dashboard)/strategy/` has a pipeline funnel visualisation (in `pipeline-funnel.tsx` or within the strategy page components). the team requested visual progress bars showing how we're tracking against each pipeline stage target.

**what to build:**

in the pipeline tab, each funnel stage (awareness → engagement → conversation → proposal → contract) should have:
- a label showing the stage name
- the current count vs. target (e.g., "12 / 30 outreach touches this week")
- a horizontal progress bar filled proportionally (current/target)
- colour coding: green (>75% of target), amber (50-75%), red (<50%)

**targets to hardcode for phase 1:**
| stage | metric | weekly target |
|-------|--------|--------------|
| awareness | outreach touches sent | 30/week |
| engagement | content pieces published | 4/month (1/week) |
| conversation | meaningful replies/conversations | 8/month (2/week) |
| proposal | proposals in flight | 2-3 at any time |
| contract | contracts signed | 2/month |

**also add a "revenue tracker" bar at the top:**
- total signed contracts YTD: show dollar amount vs $500k target
- use a large horizontal bar, navy background, teal fill
- label: "$[current] / $500,000" with percentage

use shadcn/ui `Progress` component if available, or build a simple bar with tailwind. store the targets in `strategy-data.ts`. for phase 1 the current values are hardcoded — phase 2 will pull from supabase.

**current known values (hardcode these):**
- PRME: $145,000 (signed, $48,285 received)
- Nordic: ~$50,000 (SOW in progress, 70% probability)
- pipeline total: ~$195,000 signed/near-signed
- proposals sent this month: 2 (Oxfam Denmark, UNICEF pending)
- outreach touches this week: unknown (ask garrett to update)

---

## prompt 2: social media analytics investigation + integration plan

before building anything, I need you to research and document how we should connect social media analytics to the strategy page. create a file at `port/docs/social-media-integration-plan.md` with your findings.

**platforms to investigate:**

### instagram + facebook (Meta)
- w.v instagram account: need to confirm if this is a Business or Creator account (required for API access)
- the Instagram Basic Display API was deprecated Dec 2024. all access now goes through Instagram Graph API
- requirements: Business/Creator account connected to a Facebook Page, OAuth 2.0, Meta app review (mandatory)
- **key question:** who owns the windedvertigo instagram account — garrett or payton? whoever owns it needs to be the one who connects it via Meta Business Suite. the API can only return data for accounts you own or manage.
- available metrics via API: impressions, reach, profile views, engagement (likes, comments, shares, saves), audience demographics, stories metrics
- **recommendation:** before building any integration, verify: (1) account type (Business/Creator), (2) who has admin access, (3) whether Meta app review has been started or approved

### linkedin
- payton wants to connect linkedin analytics to claude for automated reporting
- linkedin has a Marketing API and an Ads API, but organic post analytics are more limited
- **key question:** is the windedvertigo linkedin a Company Page? who has admin access? garrett's personal linkedin analytics are separate.
- simpler approach for now: payton manually exports linkedin analytics CSV weekly → upload to a shared location → port reads it

### substack
- currently showing zero in the dashboard
- substack has no public API for subscriber counts or analytics
- **options:** (1) manual entry, (2) scrape the substack dashboard (fragile), (3) use substack's email integration with resend to track opens/clicks
- **recommendation:** manual monthly entry for phase 1. add a simple form in the strategy page for updating substack metrics.

### bluesky
- bluesky has an open AT Protocol API — easiest platform to integrate
- can pull follower count, post engagement, etc.
- worth building if someone has time, but lower priority than Meta + LinkedIn

**deliverable:** write the investigation doc with recommendations for each platform. flag which accounts need ownership verification. suggest a phase 1 (manual entry) and phase 2 (API integration) approach for each.

---

## prompt 3: team pulse improvements

the team pulse strip in the strategy page currently shows team members and their assignments. feedback from the strategy playdate:

1. **fix "all Team Pulse" display issue** — garrett mentioned a bug where filtering to "all" doesn't render correctly. investigate and fix.

2. **add campaign assignment badges** — each team member card should show which of the 6 campaigns they're assigned to, using small coloured badges matching the campaign colours from the timeline view.

3. **click-to-filter** — clicking a team member should filter the campaigns tab, delegation tab, and timeline tab to show only that person's items. this was in the original spec but confirm it works.

---

## prompt 4: feedback button integration

the team was told to use the "feedback button in the port" for bugs, confusion, or feature requests. verify this exists and works:

1. check if there's a feedback button/widget on the strategy page
2. if not, add one — a small floating button (bottom-right) that opens a simple form: text area + category dropdown (bug / confusion / feature request / other) + submit
3. submissions should go somewhere retrievable — options: (a) supabase table, (b) slack message to a #port-feedback channel via wv-claw, (c) both
4. include the current page URL and user info automatically

---

## prompt 5: github access setup for lamis + payton

this isn't a port code task — it's a repo admin task. but documenting here for garrett to execute:

**what needs to happen:**
1. invite lamis@windedvertigo.com and payton (confirm email) to the windedvertigo GitHub organisation (or the repo directly)
2. give them "write" access (not admin) so they can create branches and push changes
3. set up branch protection on `main` so they can't accidentally push to production — require PR reviews

**their workflow (non-local, cloud-based):**

lamis and payton will NOT be cloning the repo locally or using terminal git commands. their workflow is:

### option A: github.dev (simplest — no setup)
- go to github.com/[org]/windedvertigo
- press the `.` (period) key → opens a full VS Code editor in the browser
- edit files, commit changes, create PRs — all in the browser
- works on phone browser too (though small screen)
- **limitation:** no terminal, no build/run capability. edit-only.
- **best for:** updating markdown files, strategy data, content in `.brain/`, small code edits

### option B: github codespaces (more powerful — has terminal)
- from the repo, click "Code" → "Codespaces" → "Create codespace"
- full VS Code in browser WITH terminal, build tools, everything
- can run `npm run dev` to preview changes locally
- 60 hours/month free on GitHub Free plan, 120 hours on Pro
- **best for:** making real code changes, running builds, testing
- **note:** claude code can be installed inside a codespace and run from there — this means lamis/payton could use claude code from any browser, including phone

### option C: claude code from phone via codespace
- create a codespace from the repo
- install claude code: `npm install -g @anthropic/claude-code`
- run `claude` in the terminal
- this gives full claude code capability from any device
- some people even do this from iPhone (see "Catnip" project on HN)

**recommendation for lamis + payton:**
- start with github.dev (option A) for familiarity
- graduate to codespaces (option B) when they want to run builds
- claude code in codespace (option C) is the power move — but not day one

**garrett action items:**
- [ ] invite lamis@windedvertigo.com to github org/repo with write access
- [ ] invite payton's email to github org/repo with write access
- [ ] set up branch protection on main (require PR, no direct push)
- [ ] send each a 2-minute loom showing: go to repo → press "." → edit a file → commit → create PR
- [ ] schedule a 15-min "github.dev walkthrough" during next whirlpool or 1:1

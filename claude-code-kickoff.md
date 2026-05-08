# claude code kickoff prompt

> paste this into a Claude Code conversation with the windedvertigo monorepo mounted.

---

I need you to build and update the port strategy page. There are two prompt files in the monorepo root that contain detailed specs:

1. **`claude-code-strategy-page.md`** — the main build spec for the strategy page at `port/app/(dashboard)/strategy/`. This is a two-phase build. Phase 1 is a static "strategy command centre" with: hero card (revenue target, pipeline math, runway), tabbed content (strategy, campaigns, channels, audience, pipeline, delegation, timeline), team pulse strip, and a visual gantt-style campaign roadmap as the centrepiece. All content is hardcoded from the marketing strategy files in `.brain/memory/marketing/`. Read this file first and follow it closely.

2. **`claude-code-port-updates.md`** — five follow-up prompts for improvements identified during the strategy playdate on May 5. These are: (1) pipeline funnel progress bars with colour-coded targets, (2) social media analytics investigation + integration plan, (3) team pulse filter fixes + campaign badges, (4) feedback button widget, (5) GitHub access documentation for non-engineer team members.

**Start by reading both files in full.** Then read the marketing strategy files they reference:
- `.brain/memory/marketing/strategy-2026-q2q3.md`
- `.brain/memory/marketing/audience-segments.md`
- `.brain/memory/marketing/channels.md`
- `.brain/memory/marketing/revenue-marketing-alignment.md`
- `.brain/memory/marketing/harbour-launch-plan.md`
- `.brain/memory/marketing/competitive-positioning.md`
- `.brain/memory/marketing/content-calendar-framework.md`
- `.brain/memory/marketing/brand-voice.md`

Work through `claude-code-strategy-page.md` first (phase 1 build), then move to the prompts in `claude-code-port-updates.md` in order. The strategy page is the priority — it needs to be live at `port.windedvertigo.com/strategy`.

The port app lives at `port/` in this monorepo. Tech stack: Next.js 16, Tailwind v4, shadcn/ui, Supabase, Auth.js v5, deployed on CF Workers as `wv-port`. Follow existing component patterns in `port/app/(dashboard)/campaigns/` and `port/app/components/`.

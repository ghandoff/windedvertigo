# 2026-07-04 — animation sprint — session 0 (kickoff)

**session type:** human-directed sprint setup
**branch:** `feat/animation-sprint`
**handed off from:** sprint docs already existed (presumably created in a separate session)

## what got done this session

- read sprint plan (`docs/prompts/creaseworks-animation-sprint.md`) and research doc
  (`research/creaseworks-animation-pipeline-options-2026-07.md`) — both complete
- read the two most recent handoff notes (2026-07-02 + 03, both cowork context-syncs —
  no prior animation work logged)
- pulled and rebased onto main; opened `feat/animation-sprint` branch
- scaffolded `docs/creaseworks-animation/characters/` and `docs/creaseworks-animation/shorts/`
- added `## sprint log` section to the plan doc; logged session 0
- proposed workstream A-1 plan (see below); awaiting garrett's go-ahead before building

## what's next (workstream A-1)

**goal:** scaffold `packages/motion-kit/` and ship ≥5 animation primitives with a
reduced-motion gate and a demo page.

**plan of attack:**
1. survey npm workspace layout — `packages/tokens/` is the pattern; `motion-kit` lives
   alongside it as `@windedvertigo/motion-kit`
2. define motion tokens (duration scale, easing curves, distance scale) extending the
   existing `@windedvertigo/tokens` pattern
3. implement `MotionGate` — respects both `prefers-reduced-motion` and creaseworks'
   calm-theme preference (stored in a CSS class or data attribute — confirm the actual
   mechanism in the creaseworks app before wiring)
4. build ≥5 primitives using Motion (framer-motion successor) for React surfaces and
   GSAP (fully free) for vanilla/site surfaces — both options, document the choice
5. demo page at `site/public/tools/motion-kit/index.html` showing every primitive with
   a live reduced-motion toggle
6. apply ≥1 primitive to a real low-risk creaseworks surface (sampler grid card
   entrance is the candidate)

**library decision to make during A-1:**
- Motion (motion.dev) for React components — MIT, first-class React 19, AI kit
- GSAP for site/vanilla surfaces — fully free, official AI skills
- these can coexist; they serve different surfaces

**key file to find before coding:** where does the creaseworks app store its
calm-theme preference? check `apps/harbour/` in this repo AND the sibling
`harbour-apps/apps/creaseworks/` — ground rule: locate before you build.

## standing blockers / flags

- **remotion licence:** free ≤3 people; wv LLC + collective structure needs a read
  of remotion.dev/docs/license before workstream C ships anywhere public. not urgent
  for A-1.
- **human pre-work still open:** google AI pro, higgsfield, elevenlabs, suno — all
  garrett tasks from the plan doc. not blocking A-1.

## how to continue

start any future session with:
1. `git pull --rebase origin main` (then switch back to `feat/animation-sprint`)
2. read this handoff note
3. read the sprint log in `docs/prompts/creaseworks-animation-sprint.md`

say "continue the animation sprint" and those two places alone are enough to resume.

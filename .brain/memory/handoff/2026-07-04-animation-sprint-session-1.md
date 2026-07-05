# 2026-07-04 — animation sprint — session 1 (workstream A-1)

**session type:** workstream A-1 — motion kit scaffold
**branch:** `feat/animation-sprint`
**handed off from:** 2026-07-04-animation-sprint-kickoff.md

## what got done

### package: `@windedvertigo/motion-kit`

new package at `packages/motion-kit/` — auto-included in root workspace via `packages/*` glob.

**files:**
- `tokens.ts` — duration (instant/fast/base/slow/cinematic), easing curves (enter/exit/sharp/springBouncy/springSnappy), distance scale (xs–xl), stagger offsets (tight/base/loose)
- `index.css` — CSS custom properties mirroring tokens.ts; reduced-motion safety net collapses all durations to 0ms when any of: `@media (prefers-reduced-motion)`, `.reduce-motion`, `.calm-theme` on `<html>`
- `gate.tsx` — `useMotionGate()` (context-based) + `useMotionGateStandalone()` (per-component). gates on ALL four signals:
  1. `prefers-reduced-motion` media query (OS)
  2. `html.classList.contains('reduce-motion')` — creaseworks in-app toggle (cookie: `cw-reduce-motion`)
  3. `html.classList.contains('calm-theme')` — creaseworks sensory mode (cookie: `cw-calm-theme`)
  4. `'still' in html.dataset` — wv-site's own `AnimationProvider` kill switch (localStorage: `wv-animations-paused`)
  MutationObserver watches `attributeFilter: ["class", "data-still"]` for live reactivity
- 5 primitives: `FadeIn`, `SlideUp`, `Stagger`, `BouncePop`, `UnderlineDraw` (all in `primitives/`)
- `index.ts` — re-exports everything

**library choice:** Motion (`motion/react` v12) for React components; GSAP (CDN) for the static demo page. Both driven by the same tokens from `tokens.ts`.

### demo page

`site/public/tools/motion-kit/index.html` — live at `/tools/motion-kit/index.html`.
- shows all 5 primitives with replay buttons
- reduced-motion toggle at the top mirrors exactly what the creaseworks prefs toggle does
- toggle confirmed working: sets `reduce-motion` class on `<html>`, status pill flips to "motion disabled (reduced)", all animations skip to final state
- GSAP loaded from CDN (demo page only, not in the React app)

### real surface

`site/components/team-grid.tsx` — `TeamGrid` now wraps members in `<Stagger className="team-grid" staggerMs={80} itemDelay={100}>`. Verified `/we/` page renders correctly. TypeCheck: clean.

### sprint definition of done

motion kit box **checked** ✓

## key discoveries

- wv-site has its own animation kill switch (`data-still` data attribute via `animation-context.tsx`/`AnimationProvider`) — not the same as the creaseworks `reduce-motion` class. gate now covers both.
- `harbour-apps/apps/creaseworks/` is the source of truth for creaseworks (NOT the `windedvertigo/apps/harbour/creaseworks/` mirror — mirror is missing `eval/`, `mini/` dirs). for A-2 creaseworks surface work, changes go in `harbour-apps/`.
- `packages/motion-kit` is in `windedvertigo` workspace. to use it in `harbour-apps/apps/creaseworks`, either (a) publish to npm or (b) add as a local path dep in harbour-apps. defer to A-2.

## what's next

**A-2 (optional, this sprint):**
- add package README to `packages/motion-kit/`
- apply 1–2 more primitives in creaseworks (harbour-apps repo) — confirm cross-repo dep approach first
- add decision log entry to `docs/cmo/decisions-log.md`

**B-1 (character bible):**
- garrett pastes character concepts → claude scaffolds `docs/creaseworks-animation/characters/{slug}/bible.md` for each
- no code needed, pure documentation

**C-1 (remotion):**
- requires: remotion licence confirmed (free ≤3 people — check collective headcount)
- `npx create-video@latest` into `apps/creaseworks-videos/`

## how to continue

`git checkout feat/animation-sprint` then say "continue the animation sprint" — read this note + sprint log in `docs/prompts/creaseworks-animation-sprint.md`.

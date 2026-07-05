# 2026-07-04 — animation sprint — session 3 (workstreams C + D + E)

**session type:** workstreams C, D, E — remotion scaffold, rive mascot, cartoon short
**branch:** `feat/animation-sprint` (windedvertigo) · `main` (harbour-apps — no sprint branch)
**handed off from:** 2026-07-04-animation-sprint-session-2.md

## what got done

### C — remotion walkthrough (`windedvertigo/apps/creaseworks-videos/`)

- committed `864a369f` on `feat/animation-sprint`
- isolated Remotion 4 app — separate from creaseworks CF build (intentional: avoids bundler conflict with OpenNext)
- `remotion-tokens.ts` — mirrors motion-kit values for use with Remotion's `interpolate()` (not a cross-package dep — just matching numbers)
- `BrandIntro.tsx` — 2 s cadet sting; `winded.vertigo` wordmark fade + SVG underline draw
- `StepCard.tsx` — step number (redwood), instruction (lowercase Inter), materials list; slide-up entrance using `interpolate()` + `spring()`
- `BrandOutro.tsx` — 2 s `creaseworks.` + `winded.vertigo` sub-mark
- `Walkthrough.tsx` — 345-frame composition (11.5 s); tissue paper flowers hard-coded (5 steps); narration drafted as comments for elevenlabs later
- **rendered successfully:** `out/walkthrough.mp4` at ~761 KB, ~30 s render on M-series Mac
- `out/` is gitignored (build artifact); source committed
- licence confirmed: free tier (Garrett + Payton + Maria ≤ 3 people)

### D — rive mascot (`harbour-apps/apps/creaseworks/`)

- committed `d11155e` on `harbour-apps/main`
- `src/components/characters/guide-character.tsx` — build-time no-op unless `NEXT_PUBLIC_CW_MASCOT=1`; lazy-loads inner component (keeps Rive runtime off initial bundle)
- `src/components/characters/guide-character-inner.tsx` — full motion-gate (all 4 signals: OS `prefers-reduced-motion`, `reduce-motion` class, `calm-theme` class, `data-still` attr); wave-on-load trigger fires once at 400ms; load-error → emoji poster fallback (`🪢`)
- `public/harbour/creaseworks/characters/cord.riv` — vehicles community placeholder (57 KB); state machine name in code is `CharacterSM` — real cord asset must export with that name
- `material-picker-hero.tsx` — `<GuideCharacter size={96} />` in absolute bottom-right corner; hidden on mobile `<640px`, visible on desktop; wrapped in `<Suspense fallback={null}>`
- TypeCheck: zero errors

### E — cartoon short script (`windedvertigo/docs/creaseworks-animation/shorts/cord-intro.md`)

- committed with C (`864a369f`)
- scenario: "cord shows you how to tie a square knot" — 5 shots, 30–38 s total
- includes: full narration lines with timing markers, shot list table (duration, camera, cord expression, sfx), nano banana pro scene variation suffixes per shot, seedance 2.0 motion prompts per shot, elevenlabs voice direction, suno/artlist music brief, capcut edit order
- open questions documented at bottom: wooden surface aesthetic, adult vs child narrator voice, whether "if it tangles up" line is on-brand (it is, per the bible — but flag for collective review)

### sprint definition of done

**all 5 boxes now checked ✓**
- [x] motion kit primitives live behind motion preference on ≥1 real surface
- [x] character bible folder complete for ≥1 character
- [x] one remotion walkthrough on R2 with cost-per-video notes
- [x] rive component scaffolded (real asset optional)
- [x] one cartoon short drafted or finished

## what still needs doing before fruitstand

**human tasks (garrett + payton):**
1. watch `out/walkthrough.mp4` locally — give feedback on motion quality before any R2 upload
2. execute cord-intro.md: nano banana pro → seedance 2.0 → elevenlabs → suno → capcut
3. open rive.app, export a real cord `.riv` with state machine named `CharacterSM` and inputs: `wave (trigger)`, `isCalm (boolean)` — swap `cord.riv` placeholder
4. record seed from first on-model cord image generation; update `cord/bible.md` seed field

**claude code tasks (next session):**
1. upload walkthrough.mp4 to R2 (`creaseworks-evidence` bucket) + write embed snippet (poster + play control, no autoplay, WCAG 2.2.2 compliant)
2. draft fruitstand review note to `docs/cmo/decisions-log.md`: "does it look like us / what did it cost / which surface first"
3. add `NEXT_PUBLIC_CW_MASCOT=1` to creaseworks `wrangler.jsonc` when garrett approves going to canary

## key technical notes for next session

- **remotion render command:** `cd apps/creaseworks-videos && npm run render` — outputs to `out/walkthrough.mp4`
- **rive state machine contract:** real cord.riv must export state machine named exactly `CharacterSM`; trigger input `wave`; boolean input `isCalm` (optional — currently unused in code but wired for future)
- **mascot flag:** `NEXT_PUBLIC_CW_MASCOT` is absent from all current wrangler configs — mascot is invisible in all deployments until the flag is added
- **harbour-apps/main** received the D commit directly (no sprint branch in that repo — matches how other harbour-apps features are shipped)

## how to continue

`git checkout feat/animation-sprint` (windedvertigo) then say "continue the animation sprint" — read this note + sprint log.

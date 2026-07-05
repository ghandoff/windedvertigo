# 2026-07-04 — animation sprint — session 2 (workstream B-1)

**session type:** workstream B-1 — character bible scaffold
**branch:** `feat/animation-sprint`
**handed off from:** 2026-07-04-animation-sprint-session-1.md

## what got done

### character bibles — all 7 complete

all 7 character bible folders scaffolded and committed at `docs/creaseworks-animation/characters/`:

| character | material | palette anchor |
|---|---|---|
| cord | rope, yarn, string | hemp tan #c9a96e, warm cream #f0e8d5, bark brown #7a5c38 |
| jugs | glass, liquids in vessels | clear glass + water blue #a8c8d8, amber #e8a855, frosted white #e8f0f4 |
| twig | wood, sticks, branches | bark grey-brown #8a7060, fresh-cut grain #d4b896, leaf green #7a9e6c |
| swatch | fabric, textiles | dusty rose #d4a096, faded indigo #7b82a8, sage #9aab89 |
| crate | cardboard, boxes | raw wood yellow #d4b56a, cardboard tan #c4a87a, grey kraft #9a8870 |
| mud | earth, clay, slip | rich earth #7a5240, ochre #c4973e, dried clay #c8b09a |
| drip | liquids, paint, watercolour | watercolour blue #6a9ec8, primary yellow #e8c840, coral #e87860, wet white #f0f4f8 |

each bible includes: material identity + what the character teaches kids, kid/grownup/never voice registers, material-rooted motion personality (idle, react on hover/tap, celebrate, calm/reduced-motion fallback), palette with hex values + notes on brand harmony, silhouette thumbnail test, avoid list, brand-role hypothesis, generation base prompt + 4 scene variation suffixes (waving, using material, celebrating, still), 7-slot image table (all ☐ not yet generated), open questions.

**commit:** `8651280b feat(character-bible): B-1 — scaffold all 7 character bibles`
**pushed:** yes — `origin/feat/animation-sprint`

### sprint definition of done

character bible box **checked** ✓ (all 7 done, not just ≥1)

## what's next

**to unblock C-1 (remotion):**
- garrett confirms: does the collective headcount exceed 3? remotion free licence is for companies ≤3 people. wv LLC + collective structure needs a read of remotion.dev/docs/license. if uncertain, creators licence is $25/seat/mo — trivial.

**D-1 (rive mascot) — can start anytime:**
- add `@rive-app/react-canvas` to creaseworks app
- build `<GuideCharacter>` component: lazy loading, poster fallback, motion-preference gate, placeholder `.riv` from rive's community files
- wire idle/wave/calm state machine
- place on sampler page corner or empty-state slot behind feature flag
- note: `.riv` authoring is garrett-in-the-editor work (rive.app tutorials); claude code handles everything around it

**image generation (parallel, garrett + payton):**
- any character bible now has a fully standalone generation prompt
- for each character: use base prompt + one scene variation suffix in nano banana pro
- record the seed from the first successful run in `bible.md` (the `seed: TBD` line) so future generations are consistent
- cord's open question (humanoid body vs single expressive rope) is worth testing first — it will inform how the others are designed

## how to continue

`git checkout feat/animation-sprint` then say "continue the animation sprint" — read this note + sprint log in `docs/prompts/creaseworks-animation-sprint.md`.

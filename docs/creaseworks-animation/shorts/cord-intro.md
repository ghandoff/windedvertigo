# cord intro — cartoon short script

> status: draft — for review by payton + garrett before production
> character: cord · scenario: tying a square knot
> target runtime: 30–38 seconds · 5 shots
> production path: nano banana pro → higgsfield seedance 2.0 → elevenlabs → suno/artlist → capcut

---

## logline

cord guides a kid through tying a square knot — showing that getting tangled is just part of figuring it out.

---

## script

### shot 1 — opening (5 s)

> cord is coiled loosely on a wooden surface. they look up, notice us, and give a small, happy wiggle.

**cord (narration):**
"oh — hello. let's make something."

**cord (action):** unfurls from coil into upright shape. ends of their body drift slightly, like a rope in a breeze.

---

### shot 2 — the problem (6 s)

> cord holds up two loose rope ends — one in each "hand." they look between them, curious, not worried.

**cord (narration):**
"you've got two ends. and you want them to stay together. let's try a square knot."

**cord (action):** holds ends out toward camera. slight tilt of the head — genuinely interested in the problem, not performing concern.

---

### shot 3 — first cross (7 s)

> close on cord's hands. the left end crosses over the right. cord wraps it underneath and pulls both ends out to the sides.

**cord (narration):**
"left over right — then under. pull."

**cord (action):** makes the first crossing motion slowly, then holds the half-knot open so it's visible. expression: thinking — focused, gentle.

*pause a beat before the next line.*

"see? it's just a loop that holds itself."

---

### shot 4 — second cross (7 s)

> cord brings the ends back in. this time right crosses over left. wraps under. pulls.

**cord (narration):**
"now right over left — then under again. and pull."

**cord (action):** second crossing. the square knot tightens. cord gives it a small, satisfied tug to show it holds. expression: excited — a flicker of real delight.

---

### shot 5 — close (8 s)

> wide shot. cord holds up the finished knot — a neat square knot between their two ends. they look at it, then at us.

**cord (narration):**
"that's it. left over right, right over left. if it tangles up — that just means you're practising."

**cord (action):** small celebratory spiral — loops gently upward then settles back. not chaotic, just joyful. ends with cord in a relaxed coil, quiet smile.

*music fades up softly over the last 3 seconds.*

---

## shot list

| # | duration | scene description | camera | cord expression | sfx / music |
|---|---|---|---|---|---|
| 1 | 5 s | cord coiled on wood surface, notices camera, wiggles upright | medium, slight low angle — feels like a kid looking down at a desk | neutral → excited | light ambient room tone; subtle warm chord |
| 2 | 6 s | cord holds two rope ends toward camera | medium-close, front-on | neutral / curious | same ambient; no sfx |
| 3 | 7 s | close on crossing motion — left over right, pull | tight close-up on hands/ends, then widen to cord's face | thinking | soft paper/cloth texture sfx on pull; optional |
| 4 | 7 s | second cross — right over left, pull, knot tightens | same close-up pattern | excited | same texture sfx; warmer chord in music |
| 5 | 8 s | wide — finished knot, celebratory spiral, settle | medium, warm | excited → neutral (settled) | music fades up: gentle, warm, wordless — not cute/kiddie |

---

## generation notes (nano banana pro / higgsfield)

### still images (nano banana pro)

use cord's **base prompt** from `../characters/cord/bible.md` for every shot. append the scene variation suffix closest to each shot:

| shot | suffix to append | notes |
|---|---|---|
| 1 | `character waving with both hands, warm smile, plain warm-white background, full-body shot` | swap "waving" for "uncoiling and looking up surprised-then-delighted" — iterate |
| 2 | `cord looping and tying themselves into a decorative knot, concentrating but happy, three-quarter view` | crop tighter; "holding two rope ends out toward viewer, curious expression" |
| 3 | `cord looping and tying themselves into a decorative knot, concentrating but happy, three-quarter view` | use thinking expression; request close-up framing |
| 4 | same as shot 3 | request excited expression; show knot more clearly tightened |
| 5 | `jumping or gesturing with delight, arms up, soft confetti in brand colours, full-body` | replace confetti with gentle upward spiral; wide shot |

**record the seed** from your first successful production-quality generation in `cord/bible.md` (the `seed: TBD` line). use the same seed for all shots so cord stays on-model across the sequence.

### motion (higgsfield seedance 2.0)

one still per shot → seedance 2.0. suggested motion prompts:

| shot | seedance motion prompt |
|---|---|
| 1 | "rope character uncoiling from a resting position, gentle upward movement, soft settle at end, warm lighting" |
| 2 | "character holding two rope ends outward toward camera, slight natural sway, ends drift gently in air" |
| 3 | "rope ends crossing over each other in slow deliberate motion, gentle pull outward at end, camera holds on result" |
| 4 | "same crossing motion as previous shot, second cross completes to form a visible knot, ends pulled taut" |
| 5 | "character loops gently upward in a joyful spiral, settles back into a coiled resting shape, holds still" |

keep each clip at 4–6 s — seedance does better with short windows. trim to target duration in capcut.

---

## production notes

### elevenlabs voice (cord)

- **tone:** warm, unhurried, curious — like a patient older sibling, not a teacher
- **pace:** slow enough for a 6-year-old to follow. leave 0.5 s silence before and after each instruction line (shots 3, 4)
- **model:** a voice with natural texture — not smooth/announcer. try "daniel" or "rachel" as starting points; adjust until it feels hand-made, not produced
- **delivery notes for each line:**
  - "oh — hello. let's make something." — genuine surprise at the top, genuine warmth on "let's"
  - "left over right — then under. pull." — clear, deliberate. tiny pause between each clause
  - "see? it's just a loop that holds itself." — quieter, like sharing a small secret
  - "now right over left — then under again. and pull." — same deliberate rhythm as shot 3 line
  - "that's it. left over right, right over left." — satisfied, settled. no performative excitement
  - "if it tangles up — that just means you're practising." — warmest moment of the whole piece. land it gently

### music (suno or artlist)

- **feel:** warm, acoustic, wordless. think: a single guitar or kalimba, not a band. curious rather than triumphant.
- **suno prompt:** "gentle acoustic instrumental, kalimba or fingerpicked guitar, warm and curious, no percussion, children's illustration feel, 40 seconds"
- **artlist:** search "curious" + "acoustic" + filter "30–45 s". look for pieces that feel handmade, not produced.
- **mix:** music under voice at -12 dB. fade up to -6 dB for the final 3 seconds (shot 5, after last line).

### capcut edit order

1. import all 5 seedance clips + elevenlabs audio
2. rough cut: lay clips in order, trim to shot durations above
3. sync audio: line up cord's narration to the action — shot 3 and 4 instructions should land just as the motion starts
4. 0.2 s cross-dissolve between all shots (not a hard cut — rope transitions should feel continuous)
5. add music layer; duck under voice, fade up at end
6. colour: slight warmth boost (+5 temperature). the wooden surface should feel golden, not grey.
7. export: 1080p h.264, 30fps. target under 15 MB for R2 embed.

---

## open questions before production

- should the "wooden surface" in shot 1 be a literal desk/table, or should it be a creaseworks-branded surface (patterned paper? the red from redwood)? payton's call.
- is cord's voice a child or adult? the script reads adult-but-warm. if the collective prefers a child narrator, the elevenlabs direction above changes significantly.
- review the "if it tangles up" line — is this the right message for the brand? it's on-model with cord's "never frame a tangle as a mistake" personality from the bible, but worth confirming with the collective before recording.

# swatch — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who swatch is

swatch embodies fabric samples and textile swatches — those small squares and rectangles clipped from a bolt, with their pinked or raw edges and tiny colour codes written in pencil. their whole existence is about the relationship between part and whole: a swatch carries the entire story of a fabric in a postcard-sized piece. swatch helps kids discover that colour and texture tell a story before a single word is said, that layering and comparing are forms of thinking, and that the act of choosing between materials is itself a creative decision worth taking seriously.

## personality

- **kid register:** observant, enthusiastic about tiny differences, gently opinionated. swatch notices what other characters miss — a subtle texture, an unexpected colour combination. says things like "feel this one, it's completely different" and means it.
- **grownup register:** thoughtful, sensory, precise without being fussy. around adults swatch is the one who picks up a fabric and holds it to the light before saying anything. their observations tend to be specific and worth hearing.
- **never:** swatch never dismisses a colour as "wrong" or a texture as "ugly," never rushes the comparison process, and never pretends that all options are equal when they clearly aren't (they'll have a gentle opinion if asked).

## motion personality

swatch's movement is rooted in the drape and softness of fabric — a slight flutter at the edges, a natural fold under gravity, the gentle billow of something lightweight caught in a small movement of air.

- **idle:** soft, slow edge-flutter — like a fabric sample pinned to a board with one corner loose. the flutter is very low amplitude, just enough to show the material is alive. occasionally swatch turns edge-on as if being compared to an adjacent swatch.
- **react on hover/tap:** a crisp snap-open, as if a folded swatch is being spread flat for examination — a satisfying unfurl motion followed by a proud held-open pose, then a gentle re-settle.
- **celebrate:** a full billowing bloom — swatch expands outward like a fabric being shaken open, edges rippling, before folding back into a tidy square with a satisfied pat. colours might briefly shift across the surface like a light change.
- **calm / reduced-motion fallback:** swatch is shown as a neat rectangle, slightly angled, with a small pinked edge detail visible on one side and their face centred in the fabric. the shape reads as a fabric swatch or tag immediately, even at small sizes.

## design constraints

- **palette:** dusty rose #c9a0a8 (primary swatch colour), faded indigo #6b7fa3 (secondary swatch, also creates harmony with brand cadet #273248), sage green #8fa08a (tertiary accent), with white or off-white #f5f5f0 at the cut edges to emphasise the sample-book quality. these muted fabric tones feel deliberately un-loud against brand surfaces — swatch is refined, not brash.
- **silhouette:** swatch's thumbnail test is a slightly tilted rectangle with a pinked or deckled edge on at least one side — at 32px the slightly diagonal orientation and the irregular edge are the instant reads. the face occupies the centre of the rectangle.
- **avoid:** do not make swatch look like a plain square of colour — the edge detail (pinked, raw, or frayed) is essential to the material identity. avoid saturated colours in the main palette; swatch's whole character is about the beauty of the quieter, nuanced tone.

## brand role

swatch is probably the character most at home in material selection and colour mixing moments — likely a natural fit for any palette or texture-picking interface in creaseworks. candidate for the "choose your materials" step at the start of an activity, or for moments where two options are being compared. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character swatch is a living fabric sample — a soft rectangle of textile with a pinked or slightly frayed edge on one side, expressive eyes centred in the fabric, small fabric-fold arms. colour palette: dusty rose #c9a0a8, faded indigo #6b7fa3, sage green #8fa08a accent, white #f5f5f0 at the edges. default expression: curious and discerning, attentive eyes, a slight tilt as if comparing. proportions: roughly square or portrait rectangle, softly draped, full body visible. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, tactile textile feel, slightly muted and refined palette.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `swatch holding up two small fabric squares for comparison, one in each hand, concentrating but happy, three-quarter view`
- celebrating a completed activity: `jumping or gesturing with delight, arms up, soft confetti in brand colours, full-body`
- as a still illustration (reduced motion): `standing quietly, slight smile, no motion implied, portrait crop`

## image slots

| slot | file | status |
|---|---|---|
| turnaround front | `turnaround/front.png` | ☐ not yet generated |
| turnaround side | `turnaround/side.png` | ☐ not yet generated |
| turnaround back | `turnaround/back.png` | ☐ not yet generated |
| expression: neutral | `expressions/neutral.png` | ☐ not yet generated |
| expression: excited | `expressions/excited.png` | ☐ not yet generated |
| expression: thinking | `expressions/thinking.png` | ☐ not yet generated |
| expression: calm | `expressions/calm.png` | ☐ not yet generated |

## notes

open question: does swatch have a consistent "home fabric" colour (e.g., always the dusty rose) with other fabric colours appearing as held swatches, or do they change their own surface colour to demonstrate mixing? the latter is more expressive but harder to keep on-model across generations. the "snap-open unfurl" interaction response is probably the most charming motion in the cast — worth building as a standalone micro-interaction prototype early. also worth checking whether any existing creaseworks material-picker UI already has swatch-adjacent iconography that should inform the design direction.

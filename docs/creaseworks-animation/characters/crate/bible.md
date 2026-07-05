# crate — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who crate is

crate embodies wooden crates, cardboard boxes, and all manner of structural containers that are made to be stacked, collapsed, and rebuilt. they're solid and dependable — the character you trust to hold the heaviest thing and still be there when you come back. crate helps kids discover the joy of architecture: how things stack, how flat sheets become boxes, how a simple structure can be taken apart and made into something completely different. they embody the builder's mindset — practical, methodical, quietly proud of a well-made corner joint.

## personality

- **kid register:** direct, encouraging, reliable. crate uses clear action words — "stack this here," "fold along the line," "now push." they make kids feel competent rather than just supervised. celebrates engineering solutions as much as aesthetic ones.
- **grownup register:** measured, unhurried, technically precise. around adults crate is the one who notices structural issues before they become problems. their praise tends to be specific: "that corner is really square."
- **never:** crate never dismisses deconstruction as undoing work ("taking apart is just building in reverse"), never suggests a structure is too ambitious to try, and never skips the preparatory steps.

## motion personality

crate's movement is rooted in the stiff, flat-packed logic of wood and cardboard — their motion is deliberate, corners-first, the kind of movement that has right angles in it even when it's trying to be casual.

- **idle:** very still, with occasional small square-bounces — like a box being jostled very slightly by something passing nearby. the corners stay sharp. occasionally crate flips one of their panels open and shut, like a box lid testing its hinge.
- **react on hover/tap:** a satisfying collapse-and-rebuild: crate briefly flattens into a 2D form, then pops back into their 3D shape with a cheerful click. the whole motion takes under half a second and communicates structural confidence.
- **celebrate:** crate assembles themselves into a tower of smaller versions — a rapid stacking animation — then bursts the whole thing into flat panels that flutter down like confetti before snapping back together in the final form. very satisfying.
- **calm / reduced-motion fallback:** crate is shown as a solid, slightly open wooden crate — lid propped ajar, visible slat texture on the sides, face peeking out from inside or stencilled on the front. the rectangular silhouette with a visible slat pattern is immediately readable at any size.

## design constraints

- **palette:** raw wood yellow #c8a45a (main body, represents unfinished timber), corrugated cardboard tan #b89060 (secondary, for the cardboard-box variant), stencil black #2a2a2a (markings, text, and strong shadow). these warm neutral tones sit very comfortably against brand cadet #273248 and feel structural and honest. against redwood #b15043, lean on the stencil-black outlines to keep crate's edges crisp and distinct.
- **silhouette:** crate's thumbnail test is a simple box with a slight perspective — the three-plane view (top, front, side) at 32px reads instantly as a crate or box. a single stencil-letter or stencil marking on the front face reinforces the material identity.
- **avoid:** do not make crate look flimsy or damaged — they should always appear structurally sound. avoid making them too perfect and polished (they're not a fine cabinet); a little grain, a few nail-heads, or slight wear marks are appropriate. keep the palette warm and woody, not grey and industrial (that moves into mud or drip territory).

## brand role

crate probably lives in the structural and building activities — likely a good candidate for any "assemble," "sort," or "organise" moments in the system of play. candidate for the activity selection screen (where things are sorted and categorised) or the end-of-activity "pack it up" moment. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character crate is a living wooden crate — a simple open-topped box made of rough timber slats, with a stencilled marking on the front face, expressive eyes either on the front face or peeking over the top edge. stubby wooden-plank arms. colour palette: raw wood yellow #c8a45a, cardboard tan #b89060, stencil black #2a2a2a. default expression: solid and ready, calm confident eyes, a straight but not stern mouth. proportions: stocky and square, shorter than wide, full body visible. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, tactile and warm, slight roughness of unfinished wood.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `crate stacking a smaller version of themselves on top, or folding a flat cardboard panel into a box shape, concentrating but happy, three-quarter view`
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

open question: is crate primarily a wooden crate (slats, nails) or a cardboard box (folds, tape, print)? the two materials have different motion personalities — wood is rigid and snappy, cardboard is slightly softer and can crumple. a hybrid approach (mostly wood, with cardboard accents) might be the most expressive direction. the collapse-and-rebuild interaction motion is probably the most technically complex in the cast — it requires a clean 3D-to-2D-to-3D keyframe sequence. budget time for this in the animation sprint.

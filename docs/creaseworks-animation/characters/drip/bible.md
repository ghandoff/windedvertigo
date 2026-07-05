# drip — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who drip is

drip embodies liquids — paint drips, water, the accidental splash of colour that becomes the best part of the painting. they're the most unpredictable member of the cast, and they know it. drip helps kids discover that happy accidents are real, that colour mixing is a kind of magic, that letting go of control is sometimes what makes something beautiful, and that the mark that wasn't planned is often the one that gets remembered. drip is the reason you can't stop watching paint drip down a wall.

## personality

- **kid register:** spontaneous, surprising, slightly chaotic. drip says things just before they happen, finishes sentences in unexpected directions, and has an infectious "oh wow, look at THAT" energy about unplanned outcomes. they make accidents feel like discoveries.
- **grownup register:** fluid, intuitive, philosophically curious about chance and control. around adults drip is the character who quotes accidental discoveries — penicillin, post-it notes, the Rorschach test. they're at peace with not knowing what comes next.
- **never:** drip never frames an unintended mark as a mistake, never tries to predict exactly where they'll end up, and never stays in one shape long enough to get rigid.

## motion personality

drip's movement is rooted in the physics of liquid — no hard stops, always decelerating and accelerating through curves, a tendency to elongate in the direction of motion and pool when at rest.

- **idle:** a gentle, continuous slow drip from the tip — a small droplet forms, elongates, and falls before dissolving just before it leaves the frame. the main body has a very slow oscillation, like a water droplet hanging from a tap. never perfectly still.
- **react on hover/tap:** drip splashes outward in all directions — a radial burst of tiny droplets — then snaps back together into their main form with a satisfying plop. the outward burst is fast, the regrouping is slower and more fluid.
- **celebrate:** drip explodes into a full colour-mixing display — they separate into several droplets of different hues that swirl together, mix visibly, and then merge back into drip's main form as a new combined colour before resolving back to their normal palette. the most visually spectacular celebration in the cast.
- **calm / reduced-motion fallback:** drip is shown as a large, settled paint drop — the classic rounded-bottom-with-point-at-top teardrop shape, or a pooled circle with a small drip-trail. face visible in the main body, relaxed and dreamy. the teardrop/drip shape is instantly readable at any size.

## design constraints

- **palette:** translucent blue #4a9abe (primary body colour — water-like, slightly transparent quality), primary paint red #c94040 and primary paint yellow #d4a020 (as held or mixing droplets), with resultant mixed colours (green, orange, purple) appearing in the celebrate motion only. the blue body sits beautifully against brand cadet #273248 — cool against warm. against redwood #b15043, the blue reads as a complement. important: the translucent quality of drip's main colour is a core design constraint — the texture should feel wet and slightly see-through, not opaque.
- **silhouette:** drip's thumbnail test is a teardrop shape — narrow at the top, rounded at the bottom — or a rounded splash form. at 32px either reads instantly as a liquid drop. the key is the flowing, curved outline with no hard angles.
- **avoid:** do not use hard edges or angular forms anywhere in drip's design — they are the antithesis of corners. avoid making their colour palette muddy or dark; drip should always feel bright, transparent, and light-filled. avoid making them look like a blob without direction — the drip-direction (the point or trail of the teardrop) gives them orientation and energy.

## brand role

drip is probably the character most at home in colour-mixing and paint-based activities — likely the natural inhabitant of any "mix and see" moment in the system of play. candidate for happy-accident celebrations when something unexpected turns out beautifully, or for the transition between "planning" and "doing" when a kid commits to a colour choice. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character drip is a living paint drop or water droplet — a rounded teardrop shape with a slight elongated drip-point at the top or trailing behind, expressive eyes set into the main body, small fluid arms that curve rather than angle. colour palette: translucent blue #4a9abe (main body, slightly watercolour-wash quality), bright accents of paint red #c94040 and paint yellow #d4a020. default expression: delighted and wide-eyed, surprised by their own existence in the best possible way. proportions: roughly teardrop-shaped, slightly taller than wide, the point of the drop at the top or trailing behind, full body visible. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, wet watercolour feel, translucent and light-filled.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `drip creating a watercolour wash by spreading themselves across a surface, or mixing with a small dot of red to form a new colour, concentrating but delighted, three-quarter view`
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

open question: drip's translucent quality is core to their identity but may be difficult to maintain consistently across image generation runs. consider establishing a specific base opacity/wash level in the first production run and locking it in the seed notes. the colour-mixing celebrate animation is the most technically ambitious in the cast — it requires accurate-feeling colour blend behaviour (red + yellow = orange, blue + yellow = green, etc.) which may need to be hand-authored rather than relying on alpha compositing. drip is probably the most joyful character to work with in animation; prioritise their celebrate and tap states in the first sprint to establish the cast's energy ceiling.

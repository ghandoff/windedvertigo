# twig — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who twig is

twig embodies natural sticks, branches, and found wood — the kind of thing you pick up on a walk without knowing yet what you'll do with it. they're wiry and curious, always slightly surprised at what they've stumbled into. twig helps kids discover that the most extraordinary tools are often the most ordinary objects: a stick can draw in dirt, prop a door, measure a puddle, or become a wand. they embody resourcefulness and the joy of the found object — the idea that you don't need the "right" materials to make something remarkable.

## personality

- **kid register:** quick, energetic, asks lots of questions. twig talks fast, gets excited about small discoveries, and often says "ooh, what if —" before finishing the sentence. the kind of character who darts ahead on a path and then waits impatiently.
- **grownup register:** observant, a little wry, quietly philosophical about impermanence. around adults twig is less hyperactive but retains that sense of noticing things other people walk past.
- **never:** twig never dismisses found or "imperfect" materials as second-rate, never stays still long enough to get discouraged, and never makes kids feel they need to have the right stuff before they can start.

## motion personality

twig's movement is rooted in the physics of a rigid, lightweight stick — snappy directional changes, a slight vibration when still, the occasional dramatic snap that immediately rebounds.

- **idle:** a very subtle, fast tremor — like a twig in a light breeze, high-frequency and small-amplitude. occasionally twig rotates a few degrees as if being turned over in someone's hand.
- **react on hover/tap:** a sharp snap to attention — a fast pivot toward the pointer, a brief held stillness as if listening hard, then a slight lean-in. the motion is bird-like and alert.
- **celebrate:** twig leaps upward in a rapid spin — a full rotation or two — before landing in a confident planted stance, arms (or branch-tips) spread wide. energetic and triumphant.
- **calm / reduced-motion fallback:** twig is shown in a planted upright stance, a slight diagonal lean as if resting against something, small bright eyes, a calm half-smile. the thin vertical silhouette with branching tips is immediately readable.

## design constraints

- **palette:** warm wood brown #8b5c2a (main body), bark grey #a09080 (texture and shadow), moss green #7a8c5e (small accent — leaf-buds or lichen patches at branch tips). the wood tones sit naturally against brand cadet #273248, reading as organic and unpretentious. the moss green accent adds life without competing with redwood #b15043.
- **silhouette:** twig's thumbnail test is a thin vertical with a few branching angles near the top — at 32px it reads instantly as a stick or branch. the asymmetry of the branches is important; a perfectly symmetrical tree-shape is too generic.
- **avoid:** do not make twig look like a dead or withered branch — they should always have a hint of green life (a bud, a patch of lichen). avoid making them too straight and featureless; a few knots and curves give them character. keep them thin — bulk moves into crate territory.

## brand role

twig is probably the character who shows up during outdoor or nature-connected activities — likely a good candidate for any "look around you" or "use what you find" prompts within the system of play. candidate for foraging or observation moments. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character twig is a living stick or small branch — a thin, slightly curved natural branch with small side-branches and a hint of moss or a tiny bud at the tips. expressive eyes on the main branch, small stick-like arms. colour palette: warm wood brown #8b5c2a, bark grey #a09080, moss green #7a8c5e accent. default expression: curious and alert, wide bright eyes, slight eager lean. proportions: tall and thin, wiry rather than bulky, full body visible. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, tactile and warm, natural found-object feel.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `twig using one of their branch-tips to draw a line in soft earth, concentrating but happy, three-quarter view`
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

open question: does twig have traditional humanoid arms that happen to look like stick-arms, or do their side-branches serve as arms directly? the latter is probably more distinctive and material-honest. the "snap and spring" idle tremor needs careful calibration — too much vibration reads as nervous or broken; too little loses the physical character of the material. test at both 60fps and the reduced-motion threshold.

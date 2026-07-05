# cord — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who cord is

cord embodies rope, string, yarn, and all the things you twist, tie, loop, and thread together. their personality is built around connection — not just the physical act of joining two points, but the curiosity that drives someone to trace a line from here to there and wonder where it leads. cord helps kids discover that patterns emerge from repetition, that things can come apart and be retied differently, and that making something together is often more interesting than making it alone.

## personality

- **kid register:** warm, encouraging, endlessly patient. cord speaks in short clear sentences, uses "let's" a lot, and never makes a kid feel tangled up — they untangle things together.
- **grownup register:** thoughtful, considered, quietly generous. around adults cord is less bouncy but no less engaged — they tend to listen more and interject with a well-timed observation rather than a running commentary.
- **never:** cord never rushes anyone, never frames a knot as a mistake ("that's just a different pattern"), and never leaves someone stranded mid-thread.

## motion personality

cord's movement is rooted in the physical elasticity and weight of natural fibre — they have a gentle give, a slight swing, a tendency to spiral rather than pivot sharply.

- **idle:** slow, gentle sway, like a length of rope hanging in a light breeze. the ends of their body (or limbs, depending on the character design direction) drift slightly in opposing directions.
- **react on hover/tap:** a satisfying snap-and-spring, as if a cord under slight tension was plucked — a quick stretch and bounce back to resting position. the motion is playful, not startled.
- **celebrate:** cord loops and spirals upward, forming a loose helix before cascading back into position — like ribbon thrown into the air. joyful, slightly chaotic, but always resolves back to form.
- **calm / reduced-motion fallback:** cord is shown in a relaxed coil, loose and settled, with a gentle smile and soft eyes. looks comfortable with stillness. the coil shape makes the silhouette immediately readable even at small sizes.

## design constraints

- **palette:** hemp/flax #c9a96e (main body), warm cream #f0e8d5 (highlights and inner loops), bark brown #7a5c38 (shadow and depth). these sit warmly against the brand cadet #273248 — the neutral tones let cord feel grounded without competing. against redwood #b15043, cord reads as the calmer counterpart.
- **silhouette:** cord's thumbnail test is a loose figure-eight or infinity shape — at 32px the looping form is the instant read. avoid anything that reads as a straight line, which loses all the character's energy at small sizes.
- **avoid:** do not make cord look tangled or messy — they should always have a sense of intentional form even when mid-motion. avoid clean vector-circle loops that read as a diagram rather than a living thing.

## brand role

cord is probably the most guide-like of the cast — the character who appears at the start of a new activity to show the thread from where you are to where you're going. likely a candidate for navigation moments: onboarding, transitioning between steps, or when a kid is choosing which activity to enter. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character cord is made of natural hemp rope and yarn — their body is a living, expressive length of cord that can form arms, a face, and a gentle torso. colour palette: hemp tan #c9a96e, warm cream #f0e8d5, bark brown #7a5c38. default expression: curious and open, slight smile, wide soft eyes. proportions: slightly chubby and approachable, roughly child-height, full body visible. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, tactile and warm.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `cord looping and tying themselves into a decorative knot, concentrating but happy, three-quarter view`
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

open question: does cord have a fully humanoid body or do they manifest as a single expressive rope that can form face-like features? the latter might be more distinctive and easier to render consistently across sizes. worth testing both in the first generation run. cord may already appear informally in transition animations on the harbour platform — check `harbour-apps/` for any existing rope/thread motifs before committing to a design direction.

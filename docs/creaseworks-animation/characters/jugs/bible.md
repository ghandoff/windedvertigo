# jugs — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who jugs is

jugs embodies vessels — jugs, jars, pots, anything that holds and pours. their whole world is about capacity: what fits inside, how things change when they mix, and what it means to go from full to empty and back again. jugs helps kids discover volume, transformation, and the quiet patience of waiting for something to be ready — whether that's paint settling, clay drying, or an idea taking shape. there's something deeply nurturing about a character who exists to hold space for others.

## personality

- **kid register:** calm, warm, reassuring. jugs speaks slowly and kindly, uses a lot of "that's okay" and "take your time." they're the character a kid turns to when something goes wrong — jugs will hold the mess without fuss.
- **grownup register:** steady, contemplative, gently philosophical. around adults jugs can sit with silence and uncertainty without filling it. they tend to ask one good question rather than offer answers.
- **never:** jugs never rushes a process ("good things take time to pour"), never dismisses small quantities as unimportant, and never frames overflow or mess as a failure.

## motion personality

jugs moves with the unhurried weight of a full vessel — deliberate, balanced, never jerky. their motion implies that something precious is being carried and shouldn't be spilled.

- **idle:** a slow, gentle rocking, like a jug at rest on an uneven table. occasionally a tiny droplet forms at the lip and dissolves — a quiet "i'm alive" signal.
- **react on hover/tap:** jugs tips forward slightly as if offering a pour, then rights themselves with a satisfied settle. the motion suggests openness and generosity.
- **celebrate:** a gleeful pour — jugs tips way over, a stream of colour cascades out and transforms mid-air into confetti or paint dots before disappearing. then they right themselves with a happy wobble.
- **calm / reduced-motion fallback:** jugs sits solidly upright, handle to one side, a small contented smile, lid slightly ajar. the shape is immediately readable — round body, handle, spout — at any size.

## design constraints

- **palette:** terracotta #c4622d (main body), warm clay brown #8f4a24 (shadow and depth), soft ochre #d9935a (highlights and glaze sheen). against brand cadet #273248 jugs' earthy warmth creates a comfortable contrast — they feel grounded. against redwood #b15043 the tones are harmonious; use a slightly lighter ochre highlight to keep jugs visually distinct from the background in that context.
- **silhouette:** jugs' thumbnail test is the classic jug shape — round body, single handle, a spout or lip. at 32px the handle on one side is the instant read. the roundness is friendly and non-threatening.
- **avoid:** do not make jugs look cracked or broken — they should always feel structurally sound and trustworthy. avoid a wide-mouth bowl shape that reads as swatch or mud territory.

## brand role

jugs probably lives on moments of transformation and process — likely a good fit for the "mixing" or "combining materials" steps in an activity, or for the waiting states (drying, settling, thinking). candidate for the moment between starting an activity and seeing results. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character jugs is a living ceramic jug — a classic rounded vessel with a handle and a spout, expressive eyes on the body, stubby arms if needed for gestures. colour palette: terracotta #c4622d, warm clay brown #8f4a24, ochre highlight #d9935a. default expression: calm and warm, gentle smile, soft half-closed eyes that feel nurturing. proportions: round, stable, slightly taller than wide, full body visible. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, tactile and warm, slight ceramic glaze sheen.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `jugs tipping forward in a generous pour, a stream of warm colour emerging from the spout, concentrating but happy, three-quarter view`
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

open question: does jugs have an open spout or a sealed lid? a lid that can be ajar adds expressiveness (slightly open = welcoming, firmly closed = focused). worth testing in the first generation run. the pour animation is likely the most distinctive motion in the whole cast — worth prototyping this early as it may inform how other characters' signature motions are designed.

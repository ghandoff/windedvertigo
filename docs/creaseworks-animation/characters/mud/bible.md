# mud — character bible

> status: draft — populate image slots and lock the generation prompt seed after the first production run

## who mud is

mud embodies earth, clay, and wet mud — the stuff that gets under your fingernails and doesn't apologise for it. mud is endlessly shapeable, and what looks like a mess is actually a material in transition: from formless to formed, from soft to hard, from temporary to permanent. mud helps kids discover the courage that comes from getting your hands dirty, that the messy middle of making something is part of the process rather than a deviation from it, and that pressing your thumb into something and leaving a mark is one of the oldest forms of making in the world.

## personality

- **kid register:** enthusiastic, irreverent, and completely unbothered by mess. mud is the first to dive in and the last to wash up. says things like "it's supposed to look like that" and "no, push harder." fundamentally joyful about the physical act of making.
- **grownup register:** philosophical about process, patient with impermanence, quietly subversive about the idea that things need to stay clean to be worthwhile. around adults mud has a wry honesty that's hard to argue with.
- **never:** mud never suggests that mess should be cleaned up before the making is finished, never frames a squashed or deformed shape as a failure, and never pretends that permanent and perfect are the same thing.

## motion personality

mud's movement is rooted in the physics of wet clay — slow when first engaged, surprisingly quick once in motion, with a satisfying squash-and-stretch quality that feels physically real and pleasurable.

- **idle:** a gentle, slow wobble — like a ball of clay sitting on a table that's very slightly uneven. occasionally a small bump appears and disappears on their surface, as if something is moving around inside. mud is never perfectly still.
- **react on hover/tap:** a delightful squash: mud compresses downward as if being pressed by a thumb, holds for a moment, then springs back up slightly taller than their rest height before settling. classic squash-and-stretch, but rooted in clay physics rather than cartoon physics.
- **celebrate:** mud undergoes a rapid series of shape transformations — a cylinder, a sphere, a flat disc, a pinched vase — before settling back into their character form with a triumphant wobble. joyful and slightly chaotic.
- **calm / reduced-motion fallback:** mud is shown as a rounded, slightly irregular form — not a perfect sphere, but a satisfying lump with character. a thumbprint or hand-impression visible on one side. face centred in the clay, content and settled. reads immediately as a ball of clay or earth at any size.

## design constraints

- **palette:** rich earth brown #6b4226 (main body), ochre #c8862a (lighter areas and surface variation), wet-clay grey #8a8070 (shadow recesses and the sheen of damp earth). these tones are warm but darker than the rest of the cast — mud should feel grounded and physical. against brand cadet #273248 the earth tones have a nice contrast; use the ochre highlights to keep mud from disappearing into the dark background. against redwood #b15043, lean on the grey-clay tones to maintain distinction.
- **silhouette:** mud's thumbnail test is an irregular, slightly lumpy rounded form — not a clean circle, but something that reads as hand-formed clay. at 32px the irregularity is the read: too smooth and they lose their identity. a thumbprint impression on the front face is a useful anchor point.
- **avoid:** do not make mud look gross or unpleasant — they should always feel like art-clay rather than literal dirt. avoid dark, monochrome designs that feel heavy or sad; the ochre highlights are essential to keeping mud feeling alive and warm. keep them round and soft, not angular (that's crate territory).

## brand role

mud is probably the character most at home in open-ended, process-first activities — likely a candidate for the "free making" or "sculpt and shape" moments in the system of play. candidate for the moment when a kid is invited to just make without a defined outcome. this is a hypothesis — do not treat as fixed.

## generation prompt (nano banana pro / flux / midjourney)

> **seed:** TBD — record the seed from the first successful production run here so future generations are consistent

**base prompt:**
```
warm hand-drawn children's illustration, slightly textured paper feel, not vector-smooth, no outlines thicker than a natural brush stroke. the character mud is a living ball of clay or wet earth — a rounded, slightly irregular form that looks hand-formed, with a visible thumbprint impression on the front face, expressive eyes set into the clay surface, small stubby clay arms. colour palette: rich earth brown #6b4226, ochre highlight #c8862a, wet-clay grey #8a8070. default expression: gleeful and a little mischievous, wide bright eyes, a big open grin. proportions: round and squat, roughly as wide as tall, slightly irregular outline to suggest hand-forming. the character should look friendly and non-threatening to children aged 5 to 10. style references: hand-painted picture-book illustration, tactile and warm, the feel of fresh clay in your hands.
```

**scene variation suffixes** (append to base prompt):
- waving hello: `character waving with both hands, warm smile, plain warm-white background, full-body shot`
- holding/using their material: `mud pressing a thumbprint into their own surface or shaping a small pot from their own clay, concentrating but delighted, three-quarter view`
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

open question: does mud leave traces of themselves behind when they interact with surfaces in the UI — small smudge marks that fade? this could be a delightful interaction detail but would need careful implementation so it doesn't feel messy in a bad way. the squash-and-stretch idle and tap response is the most physically satisfying motion in the cast — worth testing as the first animation prototype to calibrate the squash ratio across the full cast. mud's thumbprint motif could also become a recurring brand stamp (e.g., a "made with mud" seal on completed activities).

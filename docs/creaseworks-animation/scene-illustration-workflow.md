# creaseworks scene illustration workflow

How to create and wire in new scene illustrations for any play-date video.
Applies to: Remotion SceneVideo compositions, motion-kit in-app backdrops,
any creaseworks illustrated asset.

---

## two kinds of scene images

### 1. activity-specific scenes
These show the *exact* materials and steps for one play-date.
Each shot in a SceneVideo should be activity-specific.

Example — tissue paper flowers:
- Shot 2 (table scene): low wooden table with stacked tissue paper squares
  in multiple colours, pipe cleaners laid out, scissors nearby, cushions
  around the table. NO general craft clutter — only flower-making materials.
- Shot 3 (hands): two hands holding a fanned stack of tissue paper squares.
- Shot 4 (folding): hands accordion-folding the stack, visible crease lines.
- Shot 5 (flower): finished tissue paper flower held up, petals spread.

### 2. general play-date space images
These show the creaseworks environment without activity-specific props.
Use for title cards, landing pages, and cross-activity backdrops.
The table image currently in `public/playdate-table.jpg` is this type —
general craft materials, not specific to any one activity.

---

## step-by-step: creating an activity-specific scene image

### step 1 — open chatgpt (gpt-4o with image generation)

### step 2 — attach the style guide as an anchor
Upload this file to the conversation first:
`docs/creaseworks-animation/style-references/playdate-style-guide-v1.png`

Tell ChatGPT: "Use this as your style reference for all images in this session."

### step 3 — write an activity-specific prompt

Use this template:

```
Children's book illustration, european picture book style, warm cream parchment
background (#f5f0e8), subtle graph paper grid lines, muted palette (sage green,
terracotta, dusty teal), soft hand-drawn lines, colored pencil and chalk pastel
texture with paper grain, gentle contemplative mood, Beatrice Alemagna style.

Scene: [DESCRIBE THE EXACT SCENE]

Materials visible: [LIST ONLY THE MATERIALS FOR THIS ACTIVITY]
No text, no labels, no borders.
Landscape format, 16:9 ratio.
```

**Example for tissue paper flowers — shot 2 (table scene):**
```
Children's book illustration, european picture book style, warm cream parchment
background, subtle graph paper grid lines, muted palette sage green terracotta
dusty teal, soft hand-drawn lines, colored pencil and chalk pastel texture,
Beatrice Alemagna style.

Scene: low wooden craft table viewed from a 3/4 angle, four floor cushions
(sage, terracotta, dusty teal, warm yellow) around it. On the table: stacks
of tissue paper squares in soft pinks, greens, yellows and blues, pipe cleaners
in a small jar, a pair of scissors, a finished tissue paper flower as a sample.
The table feels ready and inviting — nothing else on it.

No text, no labels, no borders. Landscape 16:9.
```

**Example for tissue paper flowers — shot 3 (hands):**
```
[same style header]

Scene: close-up of two small children's hands holding a neat stack of five
tissue paper squares, fanned slightly to show the colours (pink, green, yellow,
blue, peach). Warm soft lighting from the side. Simple, focused composition.

No text. Landscape 16:9.
```

### step 4 — save the image
Save from ChatGPT → drop into:
`windedvertigo/apps/creaseworks-videos/public/`

Name it clearly: `[activity-slug]-[shot-name].jpg`
Examples: `tissue-flowers-table.jpg`, `tissue-flowers-hands.jpg`

Convert to JPEG if saved as PNG (Remotion's renderer can fail on some PNGs):
```bash
python3 -c "
from PIL import Image
img = Image.open('public/your-file.png').convert('RGB')
img.save('public/your-file.jpg', 'JPEG', quality=92)
"
```

### step 5 — wire into the video

In `src/Root.tsx`, find the `SceneVideo` composition's `defaultProps` and add
the image path using `staticFile()`:

```tsx
defaultProps={{
  table:   staticFile("tissue-flowers-table.jpg"),
  hands:   staticFile("tissue-flowers-hands.jpg"),
  folding: staticFile("tissue-flowers-folding.jpg"),
  flower:  staticFile("tissue-flowers-flower.jpg"),
}}
```

### step 6 — re-render and upload

```bash
# from windedvertigo/apps/creaseworks-videos/
npm run render:scene
npx wrangler r2 object put creaseworks-evidence/animation-sprint/scene-video-tissue-paper-flowers.mp4 \
  --file out/scene-video.mp4 --content-type video/mp4 --remote
```

The public URL after upload:
`https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/animation-sprint/scene-video-tissue-paper-flowers.mp4`

---

## naming convention for new play-dates

For each new play-date activity, create a new SceneVideo composition in `src/Root.tsx`:

```tsx
<Composition
  id="SceneVideo-[activity-slug]"   // e.g. SceneVideo-cord-knots
  component={SceneVideo}
  durationInFrames={750}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{
    table:   staticFile("[activity]-table.jpg"),
    hands:   staticFile("[activity]-hands.jpg"),
    folding: staticFile("[activity]-step3.jpg"),
    flower:  staticFile("[activity]-finished.jpg"),
  }}
/>
```

And add a render script to `package.json`:
```json
"render:[activity]": "remotion render SceneVideo-[activity-slug] out/[activity]-video.mp4 --log=verbose"
```

---

## what makes a good scene image

- **Only show what's needed for this step.** Extra props are confusing.
- **Keep the table/surface clear.** Creaseworks aesthetic is calm, not cluttered.
- **Children's hands are more evocative than the materials alone.** For steps 3–5,
  hands in frame always outperform flat lay shots.
- **The style guide anchor image is critical.** Always attach it to ChatGPT at the
  start of a session — without it, the style drifts toward generic illustration.
- **Activity-specific ≠ generic play-date space.** A general craft table (like the
  current `playdate-table.jpg`) is fine for the play-date space backdrop, but each
  shot in a walkthrough video needs to show *only the materials for that activity.*

---

## r2 bucket structure

```
creaseworks-evidence/
  animation-sprint/
    cord-cartoon-knot-tying.mp4         ← cord walkthrough (character)
    scene-video-tissue-paper-flowers.mp4 ← scene walkthrough (activity)
    [future: scene-video-[activity].mp4]
  characters/
    cord/
      [future: cord-pose-happy.jpg, etc.]
```

Public base URL: `https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/`

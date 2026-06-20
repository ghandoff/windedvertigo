# the world prowl — interactive experience app

## claude code engineering prompt

> paste this entire prompt into a Claude Code session. it contains everything needed to build the app.

---

## overview

build "the world prowl" — a full-screen, immersive, interactive web experience for a live 90-minute team session on monday 13 april 2026. it will be screen-shared by garrett during a google meet call with 5-6 people.

### reference architecture

this app follows the same pattern as the **PEDAL conference simulator** at `site/app/do/conference-experience/`. study that implementation closely — specifically:

- `site/app/do/conference-experience/conference-client.tsx` (1,365 lines) — the client-side renderer with screen types, transitions, navigation, particles, draggable elements
- `site/app/do/conference-experience/conference.css` — animation-heavy styling with CSS custom properties
- `site/app/do/conference-experience/page.tsx` — server component entry

**key differences from the PEDAL simulator:**
- this app does NOT use Notion as a CMS. all content is hardcoded — it's a one-time experience, not a reusable template.
- this app has **collective transition gates** between segments — interactive tasks that require multiple people to complete before the next screen unlocks.
- the tone is playful, spiritual, and intimate — not a conference. think retreat, not event.
- it should be screen-shared on a video call, so UI must be legible at screen-share resolution and look stunning on a large display.

### where to build it

create the app at: `harbour/app/prowl/`

this puts it under the harbour app at `windedvertigo.com/harbour/prowl`. use Next.js app router conventions. the entire experience should be a single client component (like the conference simulator) with internal state management for screen progression.

---

## brand guidelines

follow winded.vertigo brand standards exactly:

**colourways:**
| name | hex |
|------|-----|
| cadet blue (primary) | #273248 |
| redwood | #b15043 |
| burnt sienna | #cb7858 |
| champagne | #ffebd2 |
| white | #ffffff |

**typography:** all text lowercase. use the site's existing font stack.

**tone:** playful. human. dynamic. — but for this experience, lean into the spiritual and intimate end of that spectrum. poetic microcopy. generous whitespace. slow transitions.

**spelling:** british (colour, organisation, programme). oxford comma always.

---

## the five screens

### screen 1: arrive — "land here"

**visual:** full-bleed dark screen (cadet blue #273248 background). centred text fades in slowly. ambient particle effect (like the PEDAL cover screen but slower, softer — champagne-coloured particles drifting upward like fireflies).

**content:**
- large heading: "the world prowl"
- subheading: "close your eyes. breathe in for 4. hold for 4. out for 6."
- a breathing animation: a circle that expands (4s), holds (4s), contracts (6s) — three cycles. use the champagne colour (#ffebd2) with subtle opacity pulsing.
- after the breathing animation completes, text fades in: "when you open your eyes, look at the faces on your screen like you're seeing them for the first time."
- below that: the question appears letter-by-letter (typewriter effect): "what's one thing that made you feel alive this week that had nothing to do with work?"

**embedded media:** an embedded YouTube iframe (muted, autoplay, loop) as a subtle background video. use a placeholder `ALAN_WATTS_YOUTUBE_ID` — garrett will supply the exact video ID. the video should be full-bleed behind the text with a heavy dark overlay (rgba(39, 50, 72, 0.85)) so text remains legible.

**navigation:** no forward button yet. this screen flows into the first transition gate.

---

### transition gate 1: arrive → object oracle — "the gathering"

**mechanic:** a shared word cloud. the screen shows the prompt: "everyone type one word for how you feel right now." below is a text input. when garrett types a word and presses enter, it appears on screen in a random position with gentle rotation (like sticky notes on a wall). he types on behalf of each person as they say their word aloud.

**unlock condition:** when 5 words have been entered, the words drift together into a loose cluster, pulse once with a warm glow (burnt sienna), and a button appears: "ready to prowl →"

**visual:** dark background with champagne-coloured words. each word appears with a soft pop animation and finds its resting position with slight physics (float, settle). the overall effect should feel like watching fireflies gather.

---

### screen 2: object oracle — "the reading"

**visual:** warm background gradient (cadet blue → redwood). split-screen layout inspired by creaseworks' "look, make, show, wow" aesthetic.

**content:**
- heading: "the object oracle"
- instruction text: "leave your screen. 60 seconds. bring back one object that is interesting, weird, beautiful, or inexplicable."
- a large, bold countdown timer (60 seconds) that garrett can start with a button press. the timer should be visually dramatic — large numerals in champagne with a redwood progress ring.
- when the timer ends, the screen transitions to a new layout: a spotlight zone (large circle in the centre, dark vignette around it) with text: "hold up your object. the group will now read your fortune."
- below the spotlight: a text input where garrett types the group's "oracle reading" for each person. each reading appears as a card that stacks with the others.

**embedded media:** a decorative illustration area. use a placeholder `OBJECT_ORACLE_IMAGE_URL` for the paper-airplane-to-cessna process graphic garrett mentioned. display it as a large hero image during the countdown phase.

---

### transition gate 2: object oracle → deep deck live — "the knock"

**mechanic:** synchronised clicking. the screen shows a closed door illustration (simple, elegant — drawn with CSS shapes and the brand colourways). text: "knock together to open the door."

a large circular button appears with the text "knock." participants tell garrett when to click. each click produces a knock sound effect (use the Web Audio API to generate a simple knock — a short, percussive tone) and a visible ripple on the door.

**unlock condition:** 5 knocks within a 3-second window. if the knocks are too spread out, a gentle message appears: "all together now..." and the counter resets. when the timing is right, the door swings open (CSS transform: perspective + rotateY) revealing the next screen behind it.

---

### screen 3: deep deck live — "the cards"

**visual:** rich, warm atmosphere. burnt sienna background with champagne text. card-game aesthetic.

**content:**
- heading: "deep deck live"
- subheading: "the layering rule: each person goes one layer deeper than the last."
- instruction: "pull a card →" button that garrett clicks to reveal each card.

**embedded media:** an iframe of the deep deck app from the harbour. use `src="/harbour/deep-deck"` (or whatever the correct route is — check the harbour app router). the iframe should be centred, large (70% viewport width, 60% viewport height), with a subtle drop shadow and rounded corners. if the deep deck app doesn't have a standalone embeddable mode, create a simple card-flip component instead:
- a deck of 8-10 hardcoded conversation prompts (garrett can customise these)
- click to flip, card rotates 180° revealing the prompt
- prompts should range from light to deep (following the deep → deeper → deepest progression)

**fallback prompts if iframe doesn't work:**
1. "what's a sound from your childhood that you can still hear perfectly?"
2. "what's something you believe that you can't prove?"
3. "who taught you something without knowing they were teaching?"
4. "what's a question you've stopped asking?"
5. "what are you pretending not to know?"
6. "if you could un-learn one thing, what would it be?"
7. "what's the bravest thing you've never told anyone about?"
8. "when did you last feel like a beginner?"

---

### transition gate 3: deep deck live → the nicasio question — "the breath"

**mechanic:** a collective exhale visualiser. the screen shows a single flame (CSS/SVG animated candle flame in champagne/burnt sienna). text: "breathe together. hold the spacebar to exhale. the flame needs all of you."

when garrett holds the spacebar, a breath meter fills. each "exhale" (spacebar hold) adds to a shared progress bar. the flame responds — it flickers with each exhale and grows calmer as the bar fills.

**unlock condition:** cumulative spacebar-hold time reaches 30 seconds (about 5 exhales of 6 seconds each). garrett holds on behalf of the group as they breathe together. when complete, the flame settles to perfectly still, then slowly fades to reveal the next screen.

---

### screen 4: the nicasio question — "alive"

**visual:** the most cinematic screen. dark, contemplative. cadet blue background fading to near-black at the edges. minimal text, maximum space.

**content:**
- no heading at first. the screen is empty for 3 seconds.
- then, slowly (fade in over 2 seconds): "a year ago in nicasio valley, something happened that none of us could have planned."
- after 4 more seconds: "lamis said something about alive versus thrive. jamie described why we hide from uncertainty. and we stumbled onto the reason winded.vertigo exists."
- after 4 more seconds, the question appears in large type (the biggest text in the whole experience): **"when was the last time you felt truly alive?"**
- below, smaller: "not thriving. not productive. not impressive. just alive."
- further below, appearing after 10 seconds: "and what were you doing?"

**embedded media:** a photo montage area. use a placeholder `NICASIO_PHOTOS_URL` or embed a Google Photos album iframe. alternatively, create a slow-cycling gallery component that crossfades between 6-8 placeholder images (garrett will drop in actual photos from the nicasio Google Drive folder at `1h18vu8R0gz1gEnn2nhwbFvcUF3CTsFzc`). the photos should be subtle — low opacity (0.2-0.3), behind the text, slowly Ken Burns panning/zooming.

**no explicit navigation.** after at least 2 minutes on this screen (configurable), a subtle "→" arrow appears in the bottom right corner in champagne colour, barely visible. garrett clicks when the group is ready.

---

### transition gate 4: the nicasio question → drift — "the cairn"

**mechanic:** a stone-stacking ritual. the screen shows a simple landscape (minimalist illustration — horizon line, sky gradient from cadet blue to champagne). text: "each of you, place a stone."

5-6 stone shapes (simple rounded SVG shapes in the brand colourways) float at the bottom of the screen. garrett clicks each stone, and it rises to stack on a growing cairn in the centre. each stone lands with a soft "click" (Web Audio — gentle, resonant tap).

**unlock condition:** when all stones are placed, the cairn holds for a moment, then the landscape transitions (the sky brightens to champagne, and text appears in the sky): "what are you taking with you from this room?"

---

### screen 5: drift — "the closing current"

**visual:** the warmest screen. champagne background with cadet blue text. particles drift downward now (reversing the upward drift from screen 1). the whole aesthetic is sunset, exhale, ending.

**content:**
- the following passage appears, line by line, with 2-second pauses between lines:

  "the technology strand of what we do"
  "is not about making people more tech-like."
  "it is about using ai and automation"
  "to clear the path back to presence —"
  "so people touch grass,"
  "meet strangers,"
  "stay curious,"
  "remain vulnerable,"
  "and discover their aliveness."
  
- then, after a pause: "technology in service of return, not replacement."

- after the full passage has rendered, the question appears: "what are you taking with you from this room?"
- below that, a text input where garrett types each person's answer. each answer appears as a gentle line of text that drifts slowly upward (like lanterns rising).

**final moment:** after 5+ answers are entered, the entire screen slowly fades to a simple centred message: "see you wednesday. no homework." — then: "🌀" — then fade to the w.v wordmark.

---

## technical notes

### navigation
- keyboard: arrow keys or spacebar to advance (but NOT during gates — gates have their own unlock conditions)
- a minimal progress indicator at the top (thin line, champagne colour, showing % through the 5 screens)
- no back navigation during gates (forward-only momentum)
- the experience should feel like a JOURNEY, not a slideshow

### transitions
- screen-to-screen: slow crossfade (1.2s minimum)
- text reveals: staggered fade-in, letter-by-letter where noted
- gates: unique transition per gate (described above)

### audio (optional but encouraged)
- use Web Audio API for: knock sounds, stone placement, breathing cues
- no music files — garrett will play music externally. any sound effects should be subtle, UI-feedback-level

### responsive
- design for 1920×1080 (screen-share resolution) as the primary target
- it should still look good on laptop screens (1440×900, 1366×768)
- mobile is NOT a priority — this is a screen-share experience

### performance
- no external dependencies beyond what's already in the harbour app
- all animations CSS-based where possible (GPU-accelerated transforms/opacity)
- preload any embedded iframes during earlier screens

### accessibility
- all text should have sufficient contrast against backgrounds
- aria-labels on interactive elements
- reduce-motion media query should simplify (not remove) animations

---

## placeholders for garrett to fill in

these are marked in the code with comments. garrett will supply:

1. `ALAN_WATTS_YOUTUBE_ID` — the youtube video ID for the arrive screen background
2. `OBJECT_ORACLE_IMAGE_URL` — the paper-airplane-to-cessna illustration URL
3. `NICASIO_PHOTOS_URL` — array of 6-8 photo URLs from the nicasio retreat (Google Drive folder: `1h18vu8R0gz1gEnn2nhwbFvcUF3CTsFzc`)
4. deep deck route confirmation — verify the harbour route for deep deck to embed as iframe

---

## the spirit of this build

this is not a productivity tool. it is a 90-minute shared experience designed to help a small group of people who have been working too hard remember why they do what they do. every pixel should feel like an invitation to slow down.

the winded.vertigo brand insight behind it: "technology in service of return, not replacement." this app is the proof of that philosophy — technology creating space for presence, not replacing it.

build it with care. build it with play. build it with love.

---

*prompt drafted 11 april 2026 — winded.vertigo second brain (cowork) → claude code*

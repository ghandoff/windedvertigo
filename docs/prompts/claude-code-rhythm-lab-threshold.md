# claude code prompt: fix the rhythm.lab threshold experience in raft.house

> paste this into a Claude Code conversation with the windedvertigo monorepo (or harbour-apps) mounted.

---

## context

the rhythm.lab threshold experience lives in raft.house under the music section. it's one of the threshold concept apps — designed to guide learners through the struggle of understanding a concept that, once crossed, permanently changes how they hear rhythm.

right now it has three critical problems:

### problem 1: too intellectual for non-musicians
the experience reads like a music theory textbook. text-heavy prompts about polyrhythm, subdivision, syncopation. someone who doesn't read music or think in musical terms will bounce. the whole point of a threshold concept is that ANYONE can cross it — the experience needs to meet people where they are, not where a music professor is.

### problem 2: the struggle phase has no actual sound
this is the biggest gap. in the struggle phase, the app prompts learners to respond to rhythmic concepts — but nothing is actually PLAYING. there's no audio. no rhythm to feel, react to, or struggle with. the learner is asked to think about rhythm without hearing any. that's like asking someone to cross a threshold about colour while wearing a blindfold.

the fix: the struggle phase needs interactive audio. sliders, toggleable beat patterns, a simple sequencer or loop player that the learner can manipulate. they should HEAR the concept they're struggling with, not just read about it. use the Web Audio API — the rhythm.lab toy (at `/harbour/rhythm-lab`) already has a working implementation of this. borrow its audio engine or build a simpler version.

### problem 3: phases 3 and 4 are disconnected from the toy
the threshold phase (phase 3) introduces musical ideas — but doesn't connect them back to the rhythm.lab toy that the learner may have played with. there should be an explicit bridge: "remember the grid you played with? here's what was actually happening when you toggled that kick pattern. here's the threshold concept hiding inside that play."

same for phase 4 (integration/application) — the learner should be able to GO BACK to the toy with new ears. "open rhythm.lab again. this time, try to create a pattern that uses syncopation. feel the difference between what you made before and what you make now."

## what to build

### 1. find the rhythm.lab threshold experience
it's in the raft.house app. look for the music section's session definitions — likely in the harbour-apps repo under `apps/raft-house/` or similar. find the file that defines the rhythm.lab threshold phases (struggle, threshold, integration, application).

### 2. redesign the phase content

**phase 1 — encounter (the hook)**
- keep it simple and embodied: "tap your desk. tap it again. now tap it faster. where does rhythm come from?"
- play a simple looping beat (kick on 1 and 3, hi-hat on every beat) using Web Audio API
- add a tempo slider so the learner can speed it up and slow it down
- the audio should start playing automatically or on first interaction

**phase 2 — struggle (the productive confusion)**
- introduce a SECOND rhythm layer that creates tension with the first
- use an interactive element: the learner can toggle a syncopated snare pattern on/off, hearing how it clashes with and then resolves against the base beat
- slider to adjust how "off" the second layer is — from perfectly aligned (boring, safe) to fully syncopated (uncomfortable, surprising, alive)
- the prompt should acknowledge the discomfort: "does this feel wrong? good. that's the threshold. stay with it."
- DO NOT ask the learner to write or type about rhythm theory. let them FEEL it.

**phase 3 — threshold (the crossing)**
- the moment where the two rhythms click. the learner controls a "blend" slider that moves from hearing the layers separately to hearing them as one emergent groove
- explicit connection to the toy: "this is what was happening in the rhythm.lab grid. each row was a layer. when you toggled cells, you were building exactly this kind of emergent pattern — you just didn't know it yet."
- include a button: "open rhythm.lab →" that links to `/harbour/rhythm-lab` in a new tab
- the audio should demonstrate: this IS polyrhythm. you just crossed it.

**phase 4 — integration (the new ears)**
- prompt: "go back to the rhythm.lab grid. but this time, you know what subdivision means. try to build a pattern that makes you feel something. not just sounds in boxes — a groove."
- embed the rhythm.lab toy directly (iframe or component import) if architecturally possible, OR link to it prominently
- add a reflection prompt AFTER they've played: "what's different now? what do you hear that you didn't hear before the threshold?"
- this is the irreversibility test: if they can't unhear polyrhythm, the threshold is crossed.

### 3. audio implementation

use the Web Audio API. the rhythm.lab toy at `/harbour/rhythm-lab` already has a working beat sequencer. examine its source for:
- how it initialises AudioContext
- how it sequences kick, snare, hi-hat, clap samples
- how the tempo slider works
- sample loading (check for base64-encoded samples or external audio files)

for the threshold experience, you need a simpler version:
- 2-3 audio layers (not the full 4×4 grid)
- a tempo slider (reuse from the toy)
- a "tension" or "blend" slider unique to the threshold experience
- toggleable layers so the learner can hear parts in isolation vs together

if the rhythm.lab toy uses Tone.js, use the same library. if it's raw Web Audio API, stay consistent.

### 4. make it accessible for non-musicians

- NO music notation. no staff lines. no terms like "4/4 time signature" unless they emerge organically after the threshold is crossed.
- use everyday language: "the spaces between the beats," "when two patterns argue and then agree," "the moment it clicks into a groove"
- visual feedback alongside audio: pulsing circles, bouncing dots, something that shows rhythm visually for people who process that way
- the slider labels should be felt, not technical: instead of "syncopation amount (0-100%)" use "how surprising does it feel?" with a scale from "steady" to "alive"

### 5. connect to the broader raft.house experience

the rhythm.lab threshold should explicitly name itself as a threshold concept experience at the end:
- "what you just crossed is called a threshold concept. once you hear polyrhythm, you can't unhear it. that's how all of raft.house works — every session has a threshold hiding inside it."
- optionally suggest the next threshold to try (maybe tone.field or sound.color)

## important notes

- do NOT break the existing raft.house infrastructure — the threshold experience is one session among many
- test that the audio works on mobile (many raft.house sessions are played on phones)
- respect the `prefers-reduced-motion` media query — visual animations should be killable
- keep the w.v brand: cadet navy, champagne, sienna accents, inter font, lowercase everything
- the rhythm.lab toy at `/harbour/rhythm-lab` is a SEPARATE app — don't modify it. the threshold experience should complement it, not replace it

## the design principle

this is upaya — skillful means. the RIGHT tool at the RIGHT moment for the RIGHT learner. the rhythm.lab threshold experience is the threshold side of a toy↔threshold pair. it should feel like the intellectual companion to the playful toy — not a replacement for it, and not a lecture about it. the learner should arrive at understanding through their ears and hands, not through reading.

# harbour testing brief — break everything before 1 may

> for the winded.vertigo collective
> april 2026
>
> **goal:** move all 8 harbour apps from "works on my machine" to "ready for distribution" by 1 may 2026.
> **method:** structured exploration, deliberate breaking, and honest feedback.

---

## what this is

the harbour is a collection of 8 playful learning tools. they're live, they're functional, and they haven't been properly broken yet. that's your job.

this isn't a polish pass. this is a stress test. we need you to use every app the way a real person would — on your phone in a queue, on your laptop between meetings, on a tablet with a child. find the moments where something confuses you, frustrates you, or simply doesn't work. those moments are gold.

**distribution target: 1 may 2026.**

---

## the 8 apps

visit **windedvertigo.com/harbour** to access all of them.

| app | what it does | who it's for |
|-----|-------------|-------------|
| **crease.works** | design playdates using everyday materials — browse patterns, run sessions, capture evidence | parents, educators, facilitators |
| **vertigo.vault** | curated group activities with step-by-step facilitation guides | facilitators, team leads, educators |
| **deep.deck** | conversation cards that help kids (and adults) talk about hard things sideways | parents, counsellors, youth workers |
| **depth.chart** | AI-powered formative assessment generator from lesson plans and syllabi | educators, curriculum designers |
| **tidal.pool** | systems thinking sandbox — drop elements, draw connections, watch feedback loops | learners, facilitators, curious people |
| **raft.house** | multiplayer group games with real-time rooms, QR sharing, and session facilitation | facilitators, team leads, party hosts |
| **paper.trail** | hands-on activities bridging physical and digital — find, fold, unfold, capture | parents, educators, maker-space facilitators |
| **mirror.log** | personal reflection dashboard — tracks patterns across all harbour apps | anyone using the harbour regularly |

---

## how to test

### 1. pick your device, then pick your app

test on whatever you actually use. the most valuable feedback comes from real conditions, not ideal ones.

- **phone** (iOS safari, android chrome) — this is where most users will be
- **tablet** — landscape and portrait
- **laptop/desktop** — resize your window, don't just test at full screen
- **slow connection** — try on mobile data, not just wifi

### 2. try to do the thing the app promises

don't read instructions first. just try. if you can't figure out what the app does within 30 seconds, that's a finding.

for each app, try the core loop:

| app | core loop to test |
|-----|------------------|
| **crease.works** | browse materials → pick a playdate → view instructions → imagine running it |
| **vertigo.vault** | browse activities → filter by type/duration → open one → read the facilitator guide |
| **deep.deck** | pick an age group → draw cards → read prompts → imagine using them |
| **depth.chart** | upload a lesson plan or syllabus → generate assessment → review the output |
| **tidal.pool** | open the sandbox → add elements → connect them → observe behaviour. then try a pre-built scenario |
| **raft.house** | create a room → share the code/QR → join from another device → play a game together |
| **paper.trail** | browse activities → pick one → follow the steps → try capturing a photo |
| **mirror.log** | open it after using another app → check if reflections appeared → look for patterns |

### 3. then try to break it

- tap things rapidly
- rotate your phone mid-interaction
- use the back button when you're mid-flow
- try to access paid content without paying
- submit empty forms
- paste extremely long text into inputs
- open the same app in two tabs
- use it with your font size set to maximum (accessibility settings)
- try with dark mode on
- try with reduce motion enabled (settings → accessibility → motion)

### 4. record what you find

for each issue, capture:

1. **which app**
2. **what device + browser** (e.g., iPhone 14, safari; pixel 7, chrome; macbook, firefox)
3. **what you did** (step by step — assume we can't read your mind)
4. **what you expected**
5. **what actually happened**
6. **screenshot or screen recording** if possible (iOS: press side + volume up; android: press power + volume down)
7. **severity** — use this scale:
   - 🔴 **blocker** — can't use the app at all, or data loss
   - 🟠 **painful** — can work around it, but it's bad
   - 🟡 **annoying** — noticeable friction, doesn't stop you
   - 🔵 **cosmetic** — looks wrong but works fine
   - 💡 **idea** — not a bug, just something that would be better

---

## what we're specifically looking for

### usability

- [ ] can you tell what each app does within 30 seconds of landing?
- [ ] is the first interaction obvious (what do I tap/click first)?
- [ ] do you ever feel lost — not sure where you are or how to go back?
- [ ] does every button/link do what you expect?
- [ ] is the text readable without zooming?
- [ ] do images load? do they look right?

### mobile experience

- [ ] does everything fit on screen without horizontal scrolling?
- [ ] can you tap buttons easily (not too small, not overlapping)?
- [ ] does the keyboard push content up properly when typing?
- [ ] do animations feel smooth or janky?
- [ ] does the app work in both portrait and landscape?

### accessibility

- [ ] can you navigate using only your keyboard (tab, enter, escape)?
- [ ] does the app work with your phone's font size set to large/largest?
- [ ] are colours distinguishable if you have colour vision differences?
- [ ] do interactive elements have visible focus states (outlines when tabbing)?
- [ ] does the app respect "reduce motion" settings?

### content & copy

- [ ] is any text confusing, unclear, or too jargon-heavy?
- [ ] are there typos or broken sentences?
- [ ] does the tone feel consistent (lowercase, informal, warm)?
- [ ] is anything missing that you'd expect to find?

### cross-app coherence

- [ ] do the apps feel like they belong together?
- [ ] is navigation between apps smooth (harbour → app → harbour)?
- [ ] does the design language feel consistent (colours, spacing, typography)?
- [ ] does mirror.log pick up reflections from other apps?

### payment & access

- [ ] is it clear what's free and what's paid?
- [ ] do paywalls feel fair (can you see enough to decide if it's worth paying)?
- [ ] does the sign-in flow work smoothly?
- [ ] if you sign in on one app, are you signed in on others?

---

## where to send feedback

**option A (preferred):** drop findings in the designated slack channel with the format above.

**option B:** compile into a document and share directly with garrett.

**option C:** for quick things — screenshot + one sentence in a DM.

label everything with the app name so it's easy to triage.

---

## timeline

| date | milestone |
|------|-----------|
| **5–13 april** | first pass — explore all 8 apps, report first impressions and blockers |
| **14–20 april** | deep dive — pick 2-3 apps and stress test them properly |
| **21–25 april** | triage — garrett + claude prioritise and fix critical issues |
| **26–30 april** | verification — re-test fixes, final polish |
| **1 may** | distribution ready |

---

## what "distribution ready" means

we're not aiming for perfect. we're aiming for:

1. **no blockers** on mobile safari, mobile chrome, and desktop chrome
2. **core loop works** for every app — the thing it promises, it delivers
3. **first 30 seconds are clear** — new users know what to do
4. **payment flows work** — if someone wants to pay, they can
5. **nothing embarrassing** — no broken layouts, no placeholder text, no dead links
6. **accessible** — keyboard navigation works, text is readable, motion is respectful

everything else is polish, and polish comes after distribution.

---

## a note on breaking things

please do not be gentle. the worst feedback is "looks great!" when something is confusing. if you spent 10 seconds wondering what a button does, that's a finding. if you felt slightly annoyed, that's a finding. if you thought "this probably works but I'm not sure," that's a finding.

the goal is to find every rough edge before a stranger does.

thank you for breaking our things.

— garrett + claude

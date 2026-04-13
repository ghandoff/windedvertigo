# the raft — facilitated threshold crossing platform

> *use it to cross, then let it go.*

a pitch for the harbour's next game experience — a facilitated, real-time, multiplayer learning platform that nudges people across threshold concepts through play.

**notion lit review:** https://www.notion.so/325e4ee74ba48161b0ded84430c0194e

---

## the name

### top recommendation: **the raft**

the buddha's raft parable is the exact philosophy of this platform: the dharma is like a raft — useful for crossing the river, but not meant to be carried forever. games are skillful means (upaya) for crossing thresholds, not ends in themselves.

why it works:
- **nautical** — a vessel that lives in the harbour
- **buddhist** — the raft parable maps perfectly to the pedagogical philosophy
- **humble** — a raft is not a cruise ship. it's functional, intimate, a little precarious
- **polysemous** — "a raft of ideas" means a large collection; a raft also requires balance
- **short** — fits the harbour family (creaseworks, vertigo.vault, deep.deck, depth.chart, **the raft**)
- **url** — `windedvertigo.com/harbour/the-raft` or `theraft.windedvertigo.com`

tagline candidates:
- "use it to cross, then let it go."
- "facilitated crossings."
- "the harbour's vessel for threshold moments."

### runners-up

| name | tagline | why | concern |
|------|---------|-----|---------|
| **limen** | "where knowing becomes being." | latin for threshold — root of "liminal." five letters, scholarly-but-clean. | slightly obscure |
| **the crossing** | "every learner's passage." | nautical + threshold + rite-of-passage. self-explanatory. | generic, hard to trademark |
| **yaw** | "the rotation you didn't expect." | nautical axis of rotation. captures disorientation. three letters. | sounds like "yawn" |
| **threshold.craft** | "the art of crossing." | craft = boat + skill + making. transparent about purpose. | long (14 chars) |
| **the cant** | "lean into the turn." | nautical tilt + specialized jargon + Kant. triple play. | "cant" also means insincere talk |

---

## what is this?

the raft is a **facilitated, real-time, multiplayer learning platform** where a facilitator leads a group through playful experiences designed to help learners cross threshold concepts — transformative, irreversible learning moments.

think: **jackbox meets escape room meets socratic seminar.**

- a facilitator creates a session and gets a room code
- participants join on their phones (no app, no account — just a code and a name)
- the facilitator guides the group through a sequence of activities: polls, puzzles, reveals, reflections, discussions
- the platform's mechanics are designed so that **the concept IS the gameplay** — you don't learn about opportunity cost, you *feel* it through resource trade-offs
- after each crossing, the platform supports reflection and integration

### what makes it different from kahoot?

| | kahoot | the raft |
|---|---|---|
| **goal** | recall & speed | transformation & insight |
| **mechanic** | quiz (select correct answer) | epistemic games (discover, construct, reflect) |
| **assessment** | right/wrong | pre/post conceptual shift |
| **role of facilitator** | press "next" | guide through liminal space |
| **participant experience** | answer fast | struggle productively, then break through |
| **social dynamic** | competitive leaderboard | collaborative sensemaking |

---

## game mechanics — the toolkit

the raft is not a single game. it's a **platform with a toolkit of mechanics** that facilitators combine into sessions. each mechanic is a building block; sessions are sequences of blocks.

### the seven core mechanics

these were selected for the sweet spot of **high threshold-crossing potential + high facilitation-friendliness + low technical complexity:**

#### 1. forced prediction / commit-before-reveal
> before showing any information, force learners to commit to a prediction. display the distribution. then reveal. the gap between expectation and reality is where thresholds live.

- **example:** "what percentage of the world's population lives in the southern hemisphere?" → commit → reveal → "why was your estimate so far off? what assumption were you making?"
- **threshold potential:** 4/5 — makes misconceptions visible and personal
- **facilitation:** 5/5 — prediction → reveal → debrief is a perfect loop
- **tech complexity:** 1/5 — input field + aggregate + reveal. trivially simple.

#### 2. asymmetric information / role-locked perspective
> different participants have different information, abilities, or constraints. the group can only succeed by integrating partial views.

- **example:** a "doctor" sees symptoms, a "researcher" sees clinical trials, a "patient" sees lived experience, an "administrator" sees costs. the case requires all four perspectives.
- **inspired by:** keep talking and nobody explodes, spaceteam, escape rooms
- **threshold potential:** 4/5 — teaches perspective-taking and epistemic humility
- **facilitation:** 5/5 — facilitator controls information release
- **tech complexity:** 2/5 — role assignment + filtered views over websocket

#### 3. unreliable systems / epistemic doubt
> the information environment includes biased, incomplete, or contradictory sources — unlabeled. learners must develop their own heuristics for evaluating evidence.

- **example:** a research database where some studies are methodologically flawed, some sources are biased, and the learner must construct a defensible interpretation
- **inspired by:** her story, the stanley parable, inscryption
- **threshold potential:** 5/5 — trains critical epistemology
- **facilitation:** 4/5 — facilitator reveal ("source #3 was fabricated") is powerful
- **tech complexity:** 2/5 — content design challenge, not engineering

#### 4. reflection gates / "what did you learn"
> progression is locked behind articulation. you can't proceed until you explain what shifted in your thinking. not a quiz — an open-ended reflection.

- **example:** "explain to someone who hasn't done this yet why [common intuition] is misleading." or: "what would you tell your past self from 10 minutes ago?"
- **threshold potential:** 4/5 — forces consolidation of transformation
- **facilitation:** 5/5 — gives facilitator direct insight into who has crossed
- **tech complexity:** 2/5 — text input + conditional gate

#### 5. collective sensemaking under time pressure
> the group must reach consensus or make a decision before a timer expires. time pressure forces reliance on heuristics, which can then be examined in debrief.

- **example:** "you have 3 minutes to diagnose this patient as a team. go." → debrief: "who spoke first? whose voice was loudest? what evidence was ignored?"
- **inspired by:** jackbox, escape rooms, wavelength
- **threshold potential:** 3/5 — reveals assumptions through process
- **facilitation:** 5/5 — purpose-built for facilitated debrief
- **tech complexity:** 2/5 — timers + voting + real-time sync

#### 6. generative response / player-created content
> participants generate original responses (not select from options) that are then displayed, sorted, and discussed by the group.

- **example:** "draw what you think a feedback loop looks like" → display all drawings simultaneously → facilitator clusters and probes
- **inspired by:** jackbox drawful, mentimeter word clouds
- **threshold potential:** 3/5 — generation is deeper than selection
- **facilitation:** 5/5 — facilitator curation is the core value
- **tech complexity:** 2/5 — text/drawing input + display wall

#### 7. rule inversion / mechanic betrayal
> teach a system, then break it. the old model worked until it suddenly doesn't. learners must rebuild from scratch.

- **example:** a simulation where learners optimize within a paradigm, then an anomaly appears that the paradigm can't explain. the framework must be abandoned, not patched.
- **inspired by:** baba is you, undertale, paradigm shifts (kuhn)
- **threshold potential:** 5/5 — directly maps to conceptual transformation
- **facilitation:** 3/5 — needs scaffolding to avoid frustration
- **tech complexity:** 3/5 — mutable rule engines

### the facilitation arc

every threshold crossing follows a five-phase arc. the raft's activity sequencer is designed around this:

```
1. ENCOUNTER    → surface existing mental models
                  (poll, prediction, generative response)

2. STRUGGLE     → create productive cognitive dissonance
                  (puzzle, asymmetric info, unreliable systems, rule inversion)

3. THRESHOLD    → the "aha" moment
                  (facilitator-controlled reveal, mechanic betrayal)

4. INTEGRATION  → make sense of the new understanding
                  (reflection gate, discussion, replay)

5. APPLICATION  → use the new lens on something new
                  (transfer challenge, scenario, open response)
```

facilitators can build sessions using this template, customize the activities for their domain, and adjust pacing in real time.

---

## architecture

### design principles

1. **jackbox pattern** — phone-as-controller, room codes, shared screen, zero-friction join
2. **nearpod duality** — facilitator-paced (synchronous) OR self-paced (asynchronous), togglable mid-session
3. **escape room sequencing** — activities form a DAG (directed acyclic graph), not just a linear list
4. **campfire dynamic** — shared screen carries rich visuals; phones are input surfaces
5. **serverless-first** — runs on vercel + cloudflare, no dedicated servers

### tech stack

| layer | technology | why |
|-------|-----------|-----|
| **app shell** | next.js 16 on vercel | consistent with harbour monorepo |
| **real-time** | partykit on cloudflare | durable objects = rooms. free tier. edge-deployed. |
| **persistence** | cloudflare D1 | session history, analytics. free tier: 5M rows. |
| **auth (facilitators)** | auth.js v5 (google oauth) | consistent with existing harbour auth |
| **auth (participants)** | none — room code + display name | zero friction, jackbox model |
| **styling** | tailwind v4 | consistent with harbour |

### system diagram

```
┌──────────────────────────────────────────────────────┐
│                 cloudflare (DNS + edge)               │
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │  vercel (next.js)│    │  partykit (durable obj.) │ │
│  │                  │    │                          │ │
│  │  /join           │    │  RoomParty {             │ │
│  │  /play/[code]    │    │    state: RoomState      │ │
│  │  /facilitate     │    │    onConnect()           │ │
│  │  /facilitate/live│    │    onMessage()           │ │
│  │  /api/sessions   │    │    broadcastState()      │ │
│  │                  │    │  }                       │ │
│  └────────┬─────────┘    └──────────┬──────────────┘ │
│           │          ┌──────┐       │                │
│           └──────────┤  D1  ├───────┘                │
│                      └──────┘                        │
└──────────────────────────────────────────────────────┘

facilitator (laptop/projector)          participants (phones)
┌──────────────────┐                   ┌──────────────┐
│  dashboard +     │◄──── WSS ────────►│  /play/ABCD  │
│  activity ctrl   │   (partykit)      │  (mobile)    │
│  + live results  │                   │  input only  │
└──────────────────┘                   └──────────────┘
```

### data model (core)

```typescript
type RoomState = {
  code: string                    // 4-6 char room code
  facilitatorId: string           // auth'd user
  mode: "sync" | "async"          // facilitator-paced or self-paced
  status: "lobby" | "active" | "paused" | "completed"
  activities: Activity[]          // the session's activity sequence
  currentActivityIndex: number    // authoritative in sync mode
  participants: Map<string, Participant>
  timer: TimerState | null
}

type Activity = {
  id: string
  type: "poll" | "open-response" | "puzzle" | "sorting"
       | "discussion" | "reveal" | "canvas" | "reflection"
  config: ActivityConfig          // type-specific settings
  prerequisites: string[]         // activity IDs (DAG edges)
  hints: Hint[]
  timeLimit: number | null
  phase: "encounter" | "struggle" | "threshold" | "integration" | "application"
}

type Participant = {
  id: string
  displayName: string
  connectionStatus: "connected" | "disconnected"
  currentActivityIndex: number    // authoritative in async mode
  responses: Map<string, Response>
  lastSeen: number
}
```

### facilitator dashboard (live session)

```
┌─────────────────────────────────────────────────────┐
│  room: ABCD42  │  mode: [sync ▼]  │  ⏱ 12:34      │
├─────────────────────────────────────────────────────┤
│                 │                                    │
│  activity       │  participant monitor               │
│  sequence       │  ┌──────────────────────┐          │
│                 │  │ ○ alex    ✓ answered  │          │
│  ✓ 1. predict  │  │ ○ blair   ... typing  │          │
│  → 2. puzzle   │  │ ○ casey   ✓ answered  │          │
│    3. reveal   │  │ ● dana    disconn.    │          │
│    4. reflect  │  │ ○ ellis   waiting     │          │
│    5. apply    │  └──────────────────────┘          │
│                 │                                    │
│  [◀ back] [next ▶]  │  live results                │
│  [pause] [hint]     │  ┌──────────────────┐         │
│  [show results]     │  │ ████████ 45% yes │         │
│  [toggle mode]      │  │ ████     25% no  │         │
│                      │  │ █████    30% ?   │         │
│                      │  └──────────────────┘         │
└──────────────────────────────────────────────────────┘
```

### cost projection

| service | free tier? | monthly cost |
|---------|-----------|-------------|
| vercel (next.js) | yes | $0–20 |
| partykit (cloudflare) | yes — generous | $0 |
| D1 (cloudflare) | yes — 5M rows | $0 |
| auth.js | self-hosted | $0 |
| **total** | | **$0–20/mo** |

at growth (100 concurrent sessions, 5k participants): still under $50/mo.

---

## harbour integration

### how the raft fits in the harbour

the raft is a **new game in the harbour games database** alongside creaseworks, vertigo.vault, deep.deck, and depth.chart.

| game | what it does | who it's for |
|------|-------------|-------------|
| creaseworks | playdate design | parents, educators |
| vertigo.vault | facilitated group activities | facilitators |
| deep.deck | conversation cards for kids | families |
| depth.chart | AI assessment generator | educators |
| **the raft** | **facilitated threshold crossings** | **facilitators, trainers, educators** |

the raft extends the **vertigo.vault** philosophy (facilitated group activities) into a real-time, digital, multiplayer format. where vertigo.vault provides *activity recipes* for in-person facilitation, the raft provides the *digital stage* where those activities happen live.

### notion database entry

add to the harbour games database:
- **name:** the raft
- **slug:** the-raft
- **tagline:** facilitated crossings
- **description:** a real-time, multiplayer learning platform where facilitators guide groups through playful threshold concept experiences. join with a room code, cross together.
- **icon:** 🛶
- **status:** coming-soon
- **brand color:** from-teal-900/80 to-cyan-800/60 (water/crossing aesthetic)
- **accent color:** bg-teal-500
- **features:** room code join, facilitator dashboard, 7 activity types, sync/async modes, mobile-first, reflection gates
- **href:** /harbour/the-raft

---

## build sequence

recommended implementation order (est. 8–10 focused days to MVP):

### phase 1: plumbing (2 days)
1. **partykit room + join code** — two browsers talking through a room code. prove the real-time works.
2. **facilitator controls + participant view** — advance/pause/resume. facilitator sees connected participants.

### phase 2: first mechanic (1.5 days)
3. **poll activity** — submit response, aggregate, display results. validates the full message flow.
4. **prediction/reveal activity** — commit → display distribution → reveal answer. the simplest high-value mechanic.

### phase 3: facilitation layer (2 days)
5. **sync/async mode toggle** — facilitator controls vs self-pacing.
6. **timer + hint system** — escape room mechanics.
7. **reflection gate activity** — text input + facilitator review before unlock.

### phase 4: depth (2 days)
8. **asymmetric info activity** — role-based views of the same scenario.
9. **open response + display wall** — generative content with facilitator curation.

### phase 5: persistence (1.5 days)
10. **session history** — D1 storage for completed sessions and analytics.
11. **template system** — pre-built activity sequences (including the 5-phase threshold crossing template).

### phase 6: polish (1 day)
12. **harbour integration** — add to games database, landing page, branding.
13. **mobile optimization** — large touch targets, haptic feedback, offline queue.

---

## session templates (starter pack)

### template 1: the classic crossing
the standard five-phase threshold concept arc:
1. **predict** (encounter) — "what do you think happens when...?"
2. **explore** (struggle) — puzzle or simulation using current mental model
3. **reveal** (threshold) — facilitator shows why the model breaks
4. **reflect** (integration) — "what shifted in your thinking?"
5. **apply** (application) — new scenario using the transformed lens

### template 2: the detective
epistemic doubt + asymmetric information:
1. **brief** — each participant gets a different "case file" (role-locked)
2. **investigate** — timed search through shared (some unreliable) evidence
3. **convene** — group shares findings, builds collective interpretation
4. **reveal** — facilitator shows which sources were biased/fabricated
5. **reflect** — "what made you trust source X? what would you do differently?"

### template 3: the paradigm shift
rule inversion + forced prediction:
1. **learn** — participants master a system (rules, patterns, framework)
2. **predict** — "given what you know, what will happen next?"
3. **break** — an anomaly that the current framework can't explain
4. **struggle** — timed group sensemaking: "what's going on?"
5. **reframe** — facilitator introduces the new paradigm
6. **reflect** — "can you go back to the old way of seeing this?"

### template 4: the empathy engine
asymmetric roles + branching consequences:
1. **assign** — each participant gets a stakeholder role with constraints
2. **decide** — individual decisions within role (visible trade-offs)
3. **consequences** — system shows downstream effects on all stakeholders
4. **rotate** — participants switch roles, replay the scenario
5. **debrief** — "what surprised you about the other perspective?"

---

## connection to the literature review

the lit review (https://www.notion.so/325e4ee74ba48161b0ded84430c0194e) identified 12 specific game proposals for the harbour. the raft doesn't replace those — it provides the **platform infrastructure** that several of them would run on:

| lit review proposal | could run on the raft? | how |
|---|---|---|
| bias.lens | yes — perfectly | unreliable systems + forced prediction + reveal |
| signal.flow | partially | hypothesis testing sandbox as activity type |
| market.mind | yes | asymmetric roles + branching consequences |
| time.prism | yes | role-locked perspective + branching consequences |
| liminal.pass | yes — it IS the raft | the meta-game about threshold concepts |
| pattern.weave | needs canvas | would require drawing/visual activity type |
| orbit.lab | no — standalone sim | too physics-specific for generic platform |
| proof.garden | no — standalone sim | too domain-specific |
| code.weave | no — standalone sim | needs programming environment |
| rhythm.lab | no — standalone sim | needs audio engine |
| scale.shift | no — standalone sim | needs zoom/scale rendering |
| emerge.box | partially | could use canvas + rule sandbox activity type |

the raft is the **horizontal platform** that supports the ~half of harbour games that are facilitated, social, and concept-general. the other half are **vertical, domain-specific simulations** that remain standalone apps.

---

## open questions for garrett

1. **name confirmation** — is "the raft" the right vibe? or does another candidate resonate more?
2. **scope for v1** — build the full platform, or start with a single session template (e.g., "the classic crossing") and iterate?
3. **relationship to vertigo.vault** — the raft extends vault's philosophy digitally. should it be a separate product or a "digital mode" within vault?
4. **facilitator onboarding** — who are the first facilitators? w.v team only, or external educators from day one?
5. **threshold concept database** — the lit review catalogs 100 concepts. should the raft ship with pre-built sessions for specific concepts, or is it a blank canvas?
6. **shared screen assumption** — the jackbox model assumes a projector/TV. should the raft also work without a shared screen (fully on phones)?

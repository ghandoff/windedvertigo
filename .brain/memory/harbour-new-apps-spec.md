# Plan: tidal.pool + paper.trail & mirror.log Integration Analysis

## Context

The harbour has five games/apps covering creativity, dialogue, skills taxonomy, collaboration, and evidence documentation. An educational gaps analysis (`.brain/memory/harbour-educational-gaps.md`) identified six underserved skill domains. This plan specs out the top-priority new app (tidal.pool) and determines how paper.trail and mirror.log should be architected — standalone vs integrated.

---

## 1. tidal.pool — Systems Thinking Sandbox (Standalone App)

### Game Mechanics: Drop, Connect, Observe, Tinker

1. **Drop** — Drag elements from a palette into a "pool" canvas (e.g., "rainfall", "crop yield", "population", "pollution"). Each element is a node with a visible value (0–100).
2. **Connect** — Draw directed edges between elements. Four relationship types:
   - **Amplifying (+)**: more A → more B
   - **Dampening (-)**: more A → less B
   - **Delayed**: effect after N ticks
   - **Threshold**: triggers above/below a value
3. **Observe** — Press play. Watch values change, feedback loops emerge, ripple effects animate through the pool.
4. **Tinker** — Pause, adjust a variable via slider, replay. Split-view comparison: "what if we doubled rainfall?"

### Three Modes
- **Sandbox**: blank pool, full freedom
- **Scenario**: pre-built from Notion (e.g., "the fishing village") with challenge prompts
- **Challenge**: given a target outcome, work backward

### Simulation Engine

Custom lightweight stock-and-flow engine (not a physics library):

```typescript
interface PoolElement {
  id: string;
  slug: string;
  value: number;        // 0-100
  minValue: number;
  maxValue: number;
  x: number; y: number; // canvas position
}

interface Connection {
  id: string;
  from: string; to: string;
  type: 'amplifying' | 'dampening' | 'delayed' | 'threshold';
  strength: number;     // 0-1
  delay?: number;
  threshold?: number;
}

interface PoolState {
  elements: PoolElement[];
  connections: Connection[];
  tick: number;
  history: PoolElement[][]; // for rewind/comparison
}
```

- Tick-based: each tick computes all edge deltas simultaneously, applies to nodes
- Runs in `requestAnimationFrame` when playing, or step-by-step
- Pure functions, fully testable

### Rendering: HTML Canvas

- Single `<canvas>` managed via React ref + custom hook (`usePoolCanvas`)
- Elements pulse with value, connections glow with flow direction, ripple effects trace through the pool
- Drag-and-drop via manual canvas hit-testing
- Accessibility: parallel DOM representation with ARIA live regions for screen readers

### State: React 19 `useReducer` + Context

- Actions: `ADD_ELEMENT`, `REMOVE_ELEMENT`, `ADD_CONNECTION`, `MOVE_ELEMENT`, `SET_VALUE`, `TICK`, `RESET`, `LOAD_SCENARIO`
- User pools saved to `localStorage` (no auth for sandbox)
- Scenarios fetched from Notion via ISR

### Notion Databases

**tidal.pool Elements DB:**
Name, Slug, Category (select), Icon, Description, Default Value, Color, Order

**tidal.pool Scenarios DB:**
Name, Slug, Description, Difficulty (select), Elements (relation), Preset Connections (JSON in rich text), Challenge Prompt, Skills (multi-select → depth.chart), Status, Order

### depth.chart Integration
- Each scenario maps to depth.chart skills via multi-select
- Post-scenario: "skills you practiced: systems thinking, cause-and-effect reasoning" with links to `/harbour/depth-chart`

### Deployment
- Separate Vercel project: `tidal-pool-ghandoffs-projects.vercel.app`
- `basePath: "/harbour/tidal-pool"` in Next.js config
- Add rewrite rules to `site/next.config.ts` (before harbour catch-all)
- Add Notion entry to harbour games DB (status: `coming-soon`)
- Add `tidal-pool.png` tile to `harbour/public/images/`

### File Structure

```
tidal-pool/
  app/
    layout.tsx
    page.tsx                    # scenario picker (server, ISR)
    globals.css
    sandbox/page.tsx            # blank sandbox (client)
    scenario/[slug]/page.tsx    # scenario loader
    api/revalidate/route.ts
  components/
    pool-canvas.tsx
    element-palette.tsx
    connection-drawer.tsx
    simulation-controls.tsx     # play/pause/step/speed/rewind
    element-inspector.tsx
    scenario-card.tsx
    comparison-view.tsx
    skill-tag.tsx
  lib/
    simulation.ts               # pure engine (tick, graph ops)
    simulation.test.ts
    types.ts
    notion.ts
    canvas-renderer.ts
    hit-test.ts
  hooks/
    use-pool-canvas.ts
    use-simulation.ts
  next.config.ts / vercel.json / package.json / etc.
```

---

## 2. paper.trail — Physical-Digital Bridge

### Recommendation: Standalone app (7th game)

**Why not integrate into creaseworks?**
- Camera capture is a fundamentally different UX from creativity tools
- paper.trail has its own pedagogical identity (Find/Fold/Unfold/Find Again)
- Needs specific device permissions (camera) and its own CSP
- creaseworks is already scoped as a creativity platform, not a documentation tool

**Why not a cross-cutting SDK?**
- "Capture physical work" is a destination, not a utility
- Over-engineered for what's essentially an activity guide + camera + annotation

### Core Flow
1. Browse activities (from Notion) — each has materials list, step-by-step instructions, capture prompts
2. Follow physical instructions (fold, cut, build, observe)
3. Capture with device camera (`getUserMedia`)
4. Annotate on-device (canvas overlay: stamps, arrows, text labels)
5. Save to gallery (localStorage) or export to vertigo-vault (R2 upload)

### Key Technical Decisions
- **Camera**: `navigator.mediaDevices.getUserMedia()` — requires updating CSP Permissions-Policy from `camera=()` to `camera=(self)` for paper-trail paths
- **Image capture**: Client-side `<canvas>` frame grab from `<video>` element
- **Annotation**: SVG-based overlay (stamps, arrows, text) — no heavy drawing library needed
- **Storage**: R2 upload reusing creaseworks/vertigo-vault pattern (`site/lib/r2.ts`)
- **Content**: Notion database (activity title, materials, steps as rich text, capture prompts, related depth.chart skills)

### Integration Points
- **vertigo-vault**: "Save to vault" after annotation (shared R2 bucket + `@windedvertigo/auth`)
- **creaseworks**: Cross-link from sampler activities with physical components
- **depth.chart**: Activity → skill mapping via Notion multi-select

### Estimated Complexity: Medium (2-3 weeks)

---

## 3. mirror.log — Metacognitive Reflection Tool

### Recommendation: Hybrid — shared package + thin standalone app

**Why hybrid?**
- Reflection works best *in context* (right after a tidal.pool session, a creaseworks activity)
- But learners also need a *home* to browse past reflections, see patterns, track growth
- A standalone app alone feels empty without context; an embedded widget alone can't show history across apps

### Architecture

**Shared package: `packages/mirror-log/` (`@windedvertigo/mirror-log`)**
- `<ReflectionPrompt />` — embeddable post-activity component. Accepts props: `sourceApp`, `skillsExercised`, `sessionSummary`. Selects contextual prompts from a bank. Self-contained UI + localStorage persistence.
- `<ReflectionHistory />` — scrollable past reflections (for standalone app)
- `<MoodPicker />`, `<SkillFrequencyChart />`, `<StreakIndicator />`
- Prompt selection logic + default prompt bank
- localStorage adapter (`mirror-log:reflections` namespaced key)

**Thin standalone app: separate Vercel project**
- History dashboard, pattern view, settings
- Notion sync for authenticated users (read/write reflections)
- "Export as evidence" → vertigo-vault

### Data Model

```typescript
interface Reflection {
  id: string;
  timestamp: string;
  sourceApp: string;       // "tidal-pool", "creaseworks", etc.
  prompt: string;
  response: string;
  skillSlugs: string[];    // depth.chart skills
  mood?: 'energized' | 'curious' | 'frustrated' | 'calm' | 'uncertain';
}
```

### Integration: How Other Apps Embed It
Each harbour app adds `@windedvertigo/mirror-log` as a dependency and renders `<ReflectionPrompt />` at activity completion. The component handles its own storage. The standalone app reads the same localStorage.

### Key Decision: No AI in the reflection loop
Prompts are human-designed questions. Pattern analysis is simple aggregation (skill frequency, confidence over time, streaks). The value is the learner's own metacognitive work.

### Estimated Complexity: Medium-low (1.5-2 weeks for package + app)

---

## Cross-Cutting Integration Work

### `site/next.config.ts` — Rewrite Rules
Add 9 new rules (3 per app) **before** the harbour catch-all:
- `/harbour/tidal-pool[/*]` → tidal-pool Vercel project
- `/harbour/paper-trail[/*]` → paper-trail Vercel project
- `/harbour/mirror-log[/*]` → mirror-log Vercel project

### `site/next.config.ts` — CSP Updates
- Add three new Vercel domains to `connect-src`
- Change `camera=()` to `camera=(self)` in Permissions-Policy (for paper-trail)

### Harbour Hub
- Add three Notion entries to harbour games DB
- Add three tile images to `harbour/public/images/`

### Shared Package Registration
`@windedvertigo/mirror-log` auto-covered by existing `"packages/*"` workspace glob in root `package.json`

---

## Implementation Sequence

| Phase | Weeks | What |
|-------|-------|------|
| **1** | 1-4 | **tidal.pool** — simulation engine (wk1), canvas + palette + connections (wk2), scenarios + Notion (wk3), polish + deploy (wk4) |
| **2** | 5-6 | **mirror.log** — package components + localStorage (wk5), standalone app + Notion sync + embed in tidal.pool as first consumer (wk6) |
| **3** | 7-9 | **paper.trail** — camera + annotation (wk7), Notion activities + flow UX (wk8), R2 + vault integration + polish (wk9) |

This sequence puts the most complex item first, then mirror.log (which immediately tests against tidal.pool), then paper.trail.

---

## Verification

1. **tidal.pool**: Create a 3-element scenario locally, run simulation, verify feedback loops behave correctly. Test canvas rendering across mobile/desktop. Test accessibility with screen reader.
2. **mirror.log**: Embed `<ReflectionPrompt />` in tidal.pool post-scenario. Complete a reflection. Open standalone mirror-log app and verify reflection appears in history. Test localStorage persistence across page reloads.
3. **paper.trail**: Test camera capture on mobile device. Annotate a photo. Save to gallery. Test R2 upload with auth.
4. **Integration**: Verify all three appear on harbour dock page. Test rewrite rules route correctly. Confirm CSP allows all necessary connections.

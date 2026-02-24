# Evidence Capture — Practitioner Tier Feature Design

## What exists today

The run form has toggle buttons for five evidence types: photo, video, quote, artifact, notes. These store as a JSONB array of strings in `runs_cache.trace_evidence` — e.g. `["photo", "quote"]`. No actual media is uploaded. The "found_something" progress badge triggers when any evidence is tagged.

This is fine for internal dogfooding but isn't a feature anyone would pay for.

## What evidence capture should become

Evidence capture turns a run log from "I did a thing" into "here's what happened, here's what I noticed, here's what the children made." It's the difference between a checkbox and a story.

### Core concept: the run journal

Each run becomes a lightweight journal entry with three layers:

1. **The quick log** (what we have now, slightly improved)
   - Pattern linked, date, run type, context tags
   - This stays free for all tiers

2. **The evidence layer** (practitioner feature)
   - Photo upload (up to 5 per run) — children's work, setup shots, in-progress moments
   - Quote capture — things children said, with optional attribution ("Mia, age 6")
   - Observation notes — free text, but with gentle prompts:
     - "what surprised you?"
     - "what did the children do that you didn't expect?"
     - "what would you change next time?"
   - Artifact description — what was made, what materials were used, how it diverged from the pattern

3. **The reflection layer** (practitioner feature)
   - Guided reflection tied to the pattern's `arc_emphasis` — e.g. if the pattern emphasises "spatial reasoning", the reflection asks "did you notice any spatial problem-solving?"
   - Connection to developmental notes (if collective tier) — "the designer intended X, did you see Y?"
   - "Find again" journal — when something from the playdate shows up in everyday life

### What this unlocks

- **Portfolio view** — `/playbook/portfolio` — a visual gallery of all evidence across runs, filterable by pattern, collection, date range, evidence type
- **Pattern story** — on each pattern's page, practitioners see a timeline of their runs with thumbnails and quotes
- **Export** — generate a PDF or shareable link of evidence for a pattern or collection (useful for: showing parents, professional development portfolios, grant reporting)
- **Analytics enrichment** — runs with evidence count more in the analytics dashboard; patterns with rich evidence appear as "deeply explored"

## Data model changes

### New table: `run_evidence`

```sql
CREATE TABLE run_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs_cache(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,  -- 'photo', 'quote', 'observation', 'artifact'

  -- photo fields
  storage_key TEXT,             -- R2/S3 object key
  thumbnail_key TEXT,           -- smaller version for gallery views

  -- quote fields
  quote_text TEXT,
  quote_attribution TEXT,       -- "Mia, age 6"

  -- observation/artifact fields
  body TEXT,                    -- free-text content

  -- prompt that generated this (for guided reflections)
  prompt_key TEXT,              -- e.g. "what_surprised", "arc:spatial_reasoning"

  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_run_evidence_run ON run_evidence(run_id);
```

### Image storage: Cloudflare R2

- Bucket: `creaseworks-evidence`
- Path convention: `{org_id}/{run_id}/{evidence_id}.{ext}`
- Thumbnails generated on upload via Cloudflare Image Transformations (or a simple sharp worker)
- Max file size: 5MB per image (phone photos)
- Accepted types: JPEG, PNG, HEIC (convert to JPEG on upload)

### Migration path for existing data

The existing `trace_evidence` JSONB array stays as-is — it becomes the "quick log" layer. New evidence goes into `run_evidence` table. The progress tier computation checks both:

```sql
-- found_something: has evidence in EITHER location
jsonb_array_length(COALESCE(r.trace_evidence, '[]'::jsonb)) > 0
OR EXISTS (SELECT 1 FROM run_evidence re WHERE re.run_id = r.id)
```

## Entitlement gating

| Feature | Sampler | Explorer | Practitioner | Collective |
|---------|---------|----------|--------------|------------|
| Run logging (title, date, type) | ✓ | ✓ | ✓ | ✓ |
| Evidence type toggles | ✓ | ✓ | ✓ | ✓ |
| Photo upload | — | — | ✓ | ✓ |
| Quote capture with attribution | — | — | ✓ | ✓ |
| Guided observation prompts | — | — | ✓ | ✓ |
| Portfolio gallery view | — | — | ✓ | ✓ |
| Pattern story timeline | — | — | ✓ | ✓ |
| Evidence export (PDF) | — | — | ✓ | ✓ |
| Arc-linked reflection prompts | — | — | — | ✓ |
| Connection to design rationale | — | — | — | ✓ |

## UX flow

### Enhanced run form (practitioner tier)

The existing run form stays the same structure but the "more details" section expands:

```
┌─────────────────────────────────────┐
│ essentials                          │
│ title: [year 4 paper folding      ] │
│ type:  [delivery ▾]                 │
│ date:  [2026-02-23]                 │
│ pattern: [shadow puppets ▾]         │
│ □ this was a find again moment      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ▼ capture evidence                  │  ← was "more details"
│                                     │
│ 📸 photos (0/5)                     │
│ [+] tap to add                      │
│                                     │
│ 💬 quotes                           │
│ [+] add a quote                     │
│                                     │
│ 📝 observations                     │
│  what surprised you?                │
│  [...                             ] │
│                                     │
│  what did the children make?        │
│  [...                             ] │
│                                     │
│  what would you change?             │
│  [...                             ] │
│                                     │
│ 🏷️ context: [classroom] [home] ... │
│ 📦 materials used: [search...]      │
└─────────────────────────────────────┘
```

### Portfolio view (`/playbook/portfolio`)

```
┌──────────────────────────────────────────┐
│ your portfolio                           │
│                                          │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │photo│ │photo│ │photo│ │photo│  ...    │
│ │thumb│ │thumb│ │thumb│ │thumb│         │
│ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘        │
│    │       │       │       │            │
│  shadow  paper   shadow   colour        │
│  puppets folding puppets  mixing        │
│  feb 23  feb 20  feb 15   feb 12        │
│                                          │
│ [filter: all patterns ▾] [all types ▾]  │
│                                          │
│ 💬 "look, my shadow is waving!" — Mia   │
│    shadow puppets · feb 23              │
│                                          │
│ 💬 "it goes flat when I fold it twice"  │
│    paper folding · feb 20               │
└──────────────────────────────────────────┘
```

## Implementation phases

### Phase A: data model + upload (backend)

1. Create `run_evidence` table migration
2. Set up R2 bucket + presigned URL endpoint (`/api/evidence/upload-url`)
3. Create evidence CRUD API (`/api/runs/[id]/evidence`)
4. Update progress tier computation to include `run_evidence`

### Phase B: enhanced run form (frontend)

1. Add photo upload component (drag-drop + camera capture on mobile)
2. Add quote capture fields (text + attribution)
3. Replace static observation textareas with prompt-driven fields
4. Gate behind practitioner entitlement check

### Phase C: portfolio + gallery (frontend)

1. Build `/playbook/portfolio` page with masonry grid
2. Add pattern story timeline to pattern detail pages
3. Build evidence lightbox/viewer component

### Phase D: export (stretch)

1. PDF export of evidence for a pattern
2. Shareable link (public, time-limited)

## What to build now vs later

**Now (this session):** Nothing code-wise — this is a design document. The immediate value is clarity on what the practitioner tier offers.

**Next sprint:** Phase A (data model + R2) + Phase B (enhanced form). This gives us the core evidence capture flow.

**Later:** Phase C (portfolio) and Phase D (export) — these are polish that make the feature delightful but the core value is in capture.

## Implementation status (as of session 20)

All four phases are complete and deployed:

| Phase | Status | Session | Notes |
|-------|--------|---------|-------|
| A: data model + upload | ✅ Complete | 17 | migration 015, R2 bucket, evidence CRUD API, presigned upload URLs |
| B: enhanced run form | ✅ Complete | 19 | photo upload (drag-drop + camera, up to 5), quote capture, guided observations, practitioner gating |
| C: portfolio + gallery | ✅ Complete | 20 | masonry grid, type/playdate filters, full-screen lightbox with keyboard nav |
| D: export | ✅ Complete | 20 | branded PDF with embedded R2 photos, shareable public links (7-day expiry, migration 016) |

### Where to find it in the UI

- **Evidence capture** → `/runs/new` → "capture evidence" collapsible section (practitioner tier only)
- **Portfolio gallery** → `/playbook/portfolio` (also linked from `/playbook` when user has progress)
- **PDF export + share** → buttons on portfolio page (appear when evidence items exist)
- **Shared view** → `/evidence/shared/[token]` (public, no auth, expires after 7 days)

## Resolved questions

1. **R2 vs Supabase Storage** — Resolved: R2 with presigned URLs. Cheaper, S3-compatible, already on Cloudflare for domain.
2. **Video** — Deferred. Photos only for now.
3. **Offline capture** — Deferred. API is sync-friendly but no offline queue yet.
4. **Privacy** — Not yet implemented. Photo consent prompt should be added before public launch.

## What's next — candidate roadmap items

These are the natural next steps now that evidence capture is complete. Not prioritised yet.

### 1. Collections & progress tiers activation

Session 15 designed a gamification framework with collections and badges, and migration 013 created the tables (collections, user_progress, etc.), but the progress tier computation hasn't been wired to the evidence layer yet. `hasStructuredEvidence()` exists in evidence.ts but isn't called from progress recomputation. Activating this would let practitioners see their progression and feel rewarded for documenting evidence. The portfolio could show badge progress and the playbook page could surface "you're 2 reflections away from the explorer badge" nudges.

### 2. Mobile-optimised matcher

Listed as remaining in DESIGN.md. The matcher works on desktop but hasn't been specifically tuned for mobile touch interactions — the materials picker, form checkboxes, and results cards could benefit from larger touch targets, swipeable result cards, and a bottom-sheet filter pattern. This is user-facing and could drive engagement since facilitators often plan on their phones.

### 3. Notification / email digests

Now that evidence and sharing exist, there's a natural engagement loop to close. Ideas: weekly digest email showing "you captured 3 new pieces of evidence this week", notifications when someone views your shared portfolio link, progress tier milestone celebrations ("you just earned the explorer badge!"), and org-level summaries for team leads ("your team logged 12 reflections this month"). Would use Resend (already configured) for delivery.

### 4. Public landing / marketing polish

The sampler pages and pack catalogue are functional but were built for MVP. Now that the product has real depth (evidence capture, portfolios, PDF export, shareable links), the public-facing pages could benefit from conversion-focused polish: testimonials/social proof section, animated feature walkthrough, better pack comparison, and a "see what practitioners are building" showcase using anonymised shared portfolios.

### 5. Standards alignment for reflections (future)

Connect reflections and evidence to school standards frameworks (Common Core, NGSS, state-level standards). Possible directions: tag playdates or reflections with standards codes, generate standards-aligned evidence reports from the portfolio, let teachers filter portfolio by standard when preparing for evaluations or professional development documentation. This would make creaseworks directly useful for teachers who need to demonstrate standards coverage in their creative practice — turning the portfolio from a personal record into a compliance-ready artifact.

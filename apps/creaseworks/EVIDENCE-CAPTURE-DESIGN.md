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

## Open questions

1. **R2 vs Supabase Storage** — R2 is cheaper and we're already on Cloudflare for the domain. But Supabase Storage has row-level security built in. Leaning R2 with signed URLs.
2. **Video** — should we support short video clips? Storage cost goes up significantly. Could limit to 30s clips. Defer for now.
3. **Offline capture** — facilitators often work in low-connectivity environments (classrooms, outdoors). Should the form work offline with sync? Big engineering lift. Defer, but design the API to be sync-friendly.
4. **Privacy** — photos of children require consent frameworks. The app should prompt "do you have photo consent?" before enabling upload. This is a hard requirement, not a nice-to-have.

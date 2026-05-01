# depth.chart — product roadmap & business plan

*a winded.vertigo project. last updated: 15 march 2026.*

> **notion mirror**: [depth.chart — product roadmap & business plan](https://www.notion.so/324e4ee74ba481aabac2e6798d4e71bd) — keep both the markdown and Notion page in sync as we iterate.

---

## current state (v0.1 — MVP)

depth.chart is a formative assessment generator that transforms lesson plans into constructively aligned assessment tasks. faculty paste their lesson plan text, and depth.chart:

1. extracts learning objectives and classifies them on Bloom's revised taxonomy
2. generates assessment tasks with rubrics grounded in constructive alignment (Biggs, 1996)
3. produces evaluative judgment scaffolds for student self-assessment (Sadler, 1989; Tai et al., 2018)
4. applies Baquero-Vargas & Pérez-Salas (2023) six authenticity criteria with configurable weights

**stack**: Next.js 16, TypeScript, Anthropic Claude API, localStorage persistence
**live at**: windedvertigo.com/harbour/depth-chart

### what's built

- [x] lesson plan text upload + AI parsing (objectives extraction + Bloom's classification)
- [x] per-objective task generation with rubric + EJ scaffold
- [x] teacher configuration panel (time limits, collaboration mode, format preferences, authenticity weights)
- [x] plan history (localStorage, last 20 plans)
- [x] Bloom's taxonomy reference on landing page
- [x] alignment report (distribution across cognitive levels)
- [x] QTI 2.1 XML export for LMS-compatible assessment packages
- [x] CSV rubric export for gradebook-compatible rubric matrices
- [x] export menu (per-task + bulk download: PDF, QTI, CSV)
- [x] interactive landing page with animated components (Bloom's staircase, demo preview, stat counters, timeline, try-it-now box)

---

## pilot prep architecture (march → april 2026)

### auth strategy

depth-chart will adopt the same Auth.js + JWT pattern as creaseworks, sharing the `.windedvertigo.com` domain cookie for potential SSO across apps.

**providers:** Google OAuth + Resend magic link (same as creaseworks)
**session strategy:** JWT (stateless, no session table needed)
**cookie path:** `/harbour/depth-chart/api/auth` (app-scoped, like creaseworks uses `/harbour/creaseworks/api/auth`)

**key decision:** depth-chart gets its own Auth.js instance and user table (not shared with creaseworks). reasons:
- separate Neon project = clean isolation for billing, backups, and eventual independent scaling
- user data models diverge (teacher profiles vs creaseworks user profiles)
- if depth.chart moves to its own subdomain later, auth is already self-contained

**files to create:**
- `apps/depth-chart/lib/auth.ts` — Auth.js config (adapt from creaseworks pattern)
- `apps/depth-chart/app/api/auth/[...nextauth]/route.ts` — auth route handler
- `apps/depth-chart/middleware.ts` — protect `/plan/*` routes, allow `/`, `/upload` as public

### database schema

**Neon project:** separate from creaseworks (recommended for isolation).
**client:** `@vercel/postgres` (same as creaseworks — raw SQL, no ORM).

```sql
-- 001_initial_schema.sql

create table users (
  id            text primary key default gen_random_uuid()::text,
  email         text unique not null,
  name          text,
  email_verified timestamptz,
  institution   text,          -- optional, for analytics
  created_at    timestamptz default now()
);

create table plans (
  id              text primary key default gen_random_uuid()::text,
  user_id         text references users(id),
  title           text,
  subject         text,
  grade_level     text,
  raw_text        text not null,
  source_format   text default 'text',  -- text, pdf, docx
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table objectives (
  id                text primary key default gen_random_uuid()::text,
  plan_id           text references plans(id) on delete cascade,
  raw_text          text not null,
  cognitive_verb    text,
  blooms_level      text not null,
  knowledge_dimension text,
  content_topic     text,
  confidence        real,
  sort_order        int default 0
);

create table tasks (
  id                  text primary key default gen_random_uuid()::text,
  objective_id        text references objectives(id) on delete cascade,
  blooms_level        text not null,
  task_format         text not null,
  prompt_text         text not null,
  time_estimate_min   int,
  collaboration_mode  text,
  rubric_json         jsonb,       -- AnalyticRubric as JSON
  ej_scaffold_json    jsonb,       -- EJScaffold as JSON
  authenticity_json   jsonb,       -- AuthenticityScores as JSON
  reliability_notes   text[],
  created_at          timestamptz default now()
);

create table feedback (
  id          text primary key default gen_random_uuid()::text,
  user_id     text references users(id),
  task_id     text references tasks(id),
  rating      int check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now()
);

-- usage telemetry (aggregated, not per-request)
create table usage_events (
  id          text primary key default gen_random_uuid()::text,
  user_id     text references users(id),
  event_type  text not null,   -- 'plan_created', 'task_generated', 'export_pdf', 'export_qti', 'export_csv'
  metadata    jsonb,           -- blooms_level, task_format, etc.
  created_at  timestamptz default now()
);

create index idx_plans_user on plans(user_id);
create index idx_objectives_plan on objectives(plan_id);
create index idx_tasks_objective on tasks(objective_id);
create index idx_usage_user on usage_events(user_id, event_type);
create index idx_usage_created on usage_events(created_at);
```

### migration from localStorage/sessionStorage

the current flow stores plans in `sessionStorage` (plan data) and `localStorage` (plan history). the migration path:

1. **anonymous users** (no auth): continue using localStorage for plan history (free tier, 3 plans/month tracked via localStorage counter)
2. **authenticated users**: all plans persist to Neon. on first sign-in, offer to import any plans from localStorage into the DB.
3. **API routes**: add optional `user_id` parameter. if present, save to DB. if absent, return data without persisting (anonymous flow).

### env vars needed (Vercel)

| var | purpose |
|-----|---------|
| `POSTGRES_URL` | Neon connection string (new project) |
| `AUTH_SECRET` | Auth.js JWT signing key |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY` | magic link emails (shared with creaseworks or separate) |
| `ANTHROPIC_API_KEY` | already set |

### token economics: infrastructure costs for pilot

| service | pilot cost (april-june) | launch cost (august, monthly) |
|---------|------------------------|-------------------------------|
| Neon Postgres | free tier (0.5 GiB) | free tier through ~10K plans |
| Claude API | $40-100 total | $167-426/mo (see GTM section) |
| Vercel hosting | free tier | free tier (Pro at $20/mo if needed) |
| Resend emails | free tier (100/day) | free tier |
| Google OAuth | free | free |
| **total pilot infra** | **$40-100** | — |

---

## wishlist & feature roadmap

### 1. ~~multi-format upload~~ ✅ shipped

faculty should be able to upload or drag-and-drop PDFs, DOCX files, or paste a link to a Google Doc on the upload page — not just raw text.

**approach:**
- PDF: use `pdf-parse` or `pdfjs-dist` server-side to extract text, then pass to existing parse pipeline
- DOCX: use `mammoth` to extract text/HTML from .docx files
- Google Docs: accept a sharing link, use Google Docs API (or export-as-text endpoint) to fetch content
- drag-and-drop zone with file type detection + progress indicator
- fallback: if extraction quality is low, show the extracted text and let faculty edit before parsing

**files to modify:**
- `apps/depth-chart/components/upload-form.tsx` — add drag-drop zone, file input
- `apps/depth-chart/app/api/parse/route.ts` — add file upload handling, format detection, text extraction
- new: `apps/depth-chart/lib/extractors.ts` — PDF, DOCX, Google Docs extraction utilities

### 2. ~~winded.vertigo branding on generated outputs~~ ✅ shipped

scenarios, rubrics, and EJ scaffolds should each carry winded.vertigo branding — a subtle watermark or header/footer mark that establishes provenance.

**approach:**
- add a branded header to each generated output section: "depth.chart by winded.vertigo" in champagne on cadet, using the icon mark
- for downloadable PDFs (see item 3): include the full wordmark at footer with 20% opacity watermark per brand guidelines
- use `--wv-champagne` text on `--wv-cadet` background for the branding strip
- watermark placement follows brand guidelines: "white wordmark with subtle placement, transparency not exceeding 20%"

**brand assets needed:**
- `apps/site/images/logo.png` (existing wordmark)
- `packages/tokens/` colour variables (existing)

### 3. ~~downloadable branded PDFs~~ ✅ shipped

each generated assessment component (scenario, rubric, EJ scaffold) should be downloadable as a w.v-branded PDF.

**approach:**
- use `@react-pdf/renderer` or `jsPDF` for client-side PDF generation
- template: cadet header bar with depth.chart wordmark, content body, champagne footer with "a winded.vertigo project"
- watermark: full wordmark at 15-20% opacity, centred, rotated 30°
- include metadata: plan title, subject, grade level, Bloom's level, generation date
- download button on each task card + bulk "download all" option

**files to create:**
- `apps/depth-chart/lib/pdf-template.tsx` — branded PDF layout component
- `apps/depth-chart/components/download-button.tsx` — per-task and bulk download

### 4. LMS integration (canvas, blackboard, moodle)

depth.chart should fit into faculty workflows by supporting direct export to learning management systems.

**approach (phased):**

**phase 1 — export formats** ✅ partially shipped (QTI 2.1 + CSV)
- ~~QTI (question and test interoperability) XML export for rubrics — supported by Canvas, Blackboard, Moodle, Brightspace~~ ✅ shipped (QTI 2.1 assessment item export)
- IMS Common Cartridge package for full assessment bundles
- ~~CSV export for gradebook-compatible rubric matrices~~ ✅ shipped

**phase 2 — LTI integration**
- implement LTI 1.3 (learning tools interoperability) as an external tool
- faculty launches depth.chart from within their LMS
- generated tasks publish back to the LMS assignment area
- requires: OAuth 2.0 flow, JWKS endpoint, deep linking spec

**phase 3 — direct API integration**
- Canvas REST API: create assignments, attach rubrics
- Blackboard REST API: create assessments
- Moodle Web Services API: create quiz/assignment resources
- each integration behind a feature flag, rolled out per institution

**competitive note:** most assessment tools stop at PDF export. LTI integration is a major differentiator for institutional adoption.

### 5. ~~visual design & imagery~~ ✅ shipped (landing page redesign)

the landing page was redesigned with interactive, animated components replacing the text-heavy layout. no external assets needed — all visuals are CSS + React.

**what shipped (15 march 2026):**
- `bloom-staircase.tsx` — ascending bar chart of 6 Bloom's levels with scale-in animation, LOCS/HOCS divider
- `blooms-grid.tsx` — interactive Bloom's taxonomy cards with hover glow, color borders, staggered verb pills
- `how-it-works.tsx` — vertical timeline with inline SVG icons and IntersectionObserver scroll-triggered reveal
- `demo-preview.tsx` — before/after showing objective → generated task transformation with rubric + authenticity scores
- `stat-counters.tsx` — animated count-up numbers (6 cognitive levels, 11 task formats, 4 export formats)
- `try-it-box.tsx` — inline textarea that routes to upload page with pre-filled text
- alternating section backgrounds with `bg-white/[0.02]` and `border-white/5` for visual rhythm
- credibility strip with bold framework names (Bloom's taxonomy, constructive alignment, authenticity criteria, evaluative judgment)

**still open for future iteration:**
- commissioned illustrations for each Bloom's taxonomy level
- lottie animations for the parse → generate → scaffold flow
- photography assets per brand guidelines

---

## business plan

### the opportunity

higher education faces a persistent gap between learning objectives and assessment practice. faculty write learning objectives (often required by accreditation bodies), but the assessments they create frequently misalign with those objectives — testing recall when the objective targets analysis, or using formats that don't match the cognitive level required.

this misalignment is well-documented:
- Biggs (1996) showed that constructive alignment between objectives, activities, and assessments is the single strongest predictor of learning quality
- Bloom's taxonomy (revised by Anderson & Krathwohl, 2001) provides the cognitive framework, but faculty rarely map assessments systematically to it
- Baquero-Vargas & Pérez-Salas (2023) identified six authenticity criteria that make assessments meaningful, but applying all six requires expertise most faculty lack

**depth.chart automates what currently requires assessment design expertise.**

### target market

**primary:** higher education faculty (universities, colleges, community colleges)
- estimated 1.5M faculty in the US alone (NCES)
- assessment design is a pain point across all disciplines
- accreditation requirements increasingly demand documented alignment

**secondary:** instructional designers and curriculum developers
- employed by institutions to support faculty
- fewer in number but higher per-user value
- often responsible for programme-level assessment maps

**tertiary:** K-12 educators (future expansion)
- larger market but different needs (standards-based, not objectives-based)
- would require curriculum standards integration (Common Core, NGSS, etc.)

### revenue model

**freemium SaaS with institutional licensing:**

| tier | price | features |
|------|-------|----------|
| **free** | $0 | 3 plans/month, text upload only, basic task generation |
| **faculty** | $12/month or $99/year | unlimited plans, PDF/DOCX upload, branded PDF export, plan history, full authenticity config |
| **department** | $49/month (up to 10 seats) | everything in faculty + shared plan library, department-level analytics, LMS export (QTI/CSV) |
| **institution** | custom pricing | everything in department + LTI integration, SSO, dedicated support, custom branding, API access |

**pricing rationale:**
- $12/month is below the "requires purchase order" threshold at most institutions — faculty can expense it or pay personally
- department tier targets chairs/programme leads who want consistency across courses
- institutional tier is the growth engine — once embedded via LTI, switching costs are high

### competitive landscape

| competitor | approach | gap depth.chart fills |
|------------|----------|----------------------|
| **Chalk** | curriculum mapping platform | no AI-powered assessment generation; manual rubric building |
| **Turnitin** | plagiarism + feedback | detection, not generation; no constructive alignment |
| **Respondus** | exam authoring | test-bank focused; no learning objective analysis |
| **ChatGPT / generic AI** | prompt-and-pray | no pedagogical framework; no authenticity criteria; no systematic alignment |
| **ExamSoft** | secure testing | delivery platform, not a design tool |

**depth.chart's moat:**
1. **methodological rigour** — grounded in published assessment theory, not generic AI prompts
2. **evaluative judgment scaffolds** — unique feature; no competitor generates self-assessment frameworks
3. **authenticity criteria** — configurable six-criteria framework from peer-reviewed research
4. **constructive alignment engine** — systematically maps objectives → tasks → rubrics at the correct cognitive level

### go-to-market strategy

*aligned to academic calendar — fall term start is the launch window.*

**phase 1 — pilot prep (march → april 2026)**

build the infrastructure needed for a real pilot with tracked usage:

- [ ] **auth**: Auth.js (Google + email magic link) — faculty log in to persist plans across sessions
- [ ] **persistent storage**: Neon Postgres (consistent with creaseworks) — migrate from sessionStorage/localStorage to server-side plan storage per user
- [ ] **usage telemetry**: track per-user metrics — Bloom's level distribution, format preferences, AI override rate, generation count, time-to-export
- [ ] **feedback mechanism**: in-app post-generation feedback ("was this task useful?" + optional free text), stored in DB
- [ ] **free tier enforcement**: plan count tracking (3 plans/month for unauthenticated, unlimited for pilot cohort)
- [ ] **pilot onboarding email**: branded invite via Resend with quick-start guide

**phase 2 — faculty pilot (april → june 2026, spring term)**

- recruit 10-15 faculty beta testers from wv's existing network
- pilot cohort gets unlimited access (no tier limits during pilot)
- collect usage data: which Bloom's levels are most common, which formats are preferred, where faculty override AI suggestions
- iterate on generation quality based on feedback
- bi-weekly check-ins (email or short survey) to capture qualitative feedback
- target: each pilot faculty generates at least 5 plans across the term

**pilot success metrics:**
- ≥10 active users (generated ≥3 plans each)
- task quality rating ≥4/5 average
- ≥60% of generated tasks used without major edits
- clear signal on which export formats matter most (PDF vs QTI vs CSV)

**pilot token economics:**

| metric | estimate |
|--------|----------|
| 15 faculty × ~4 plans/month × 3 months | ~180 plan generations |
| cost per plan (5 objectives, Opus 4.6) | $0.22-0.56 |
| **total pilot API cost** | **$40-100** |
| with Sonnet for parse step | ~$25-60 |

**phase 3 — launch prep (june → july 2026)**

- [ ] **Stripe billing**: free tier (3 plans/month, enforced) + faculty tier ($12/month or $99/year)
- [ ] **tier enforcement**: rate limiting on API routes, plan count tracking per billing period
- [ ] **marketing content**: SEO metadata, 2-3 blog posts on constructive alignment + assessment design, short demo video
- [ ] **conference submissions**: OLC Accelerate (deadline typically July), EDUCAUSE annual (deadline typically June)
- [ ] **SEO**: target "assessment generator," "rubric builder," "constructive alignment tool," "Bloom's taxonomy assessment"
- [ ] **testimonials**: collect quotes from pilot faculty for landing page social proof

**phase 4 — public launch (august 2026, fall term start)**

- launch free + faculty tiers — timed so faculty have it in-hand for fall syllabi prep
- landing page social proof from pilot testimonials
- content marketing push: blog posts, social, targeted ed-tech communities
- monitor conversion: free → faculty tier
- support channel (email or Slack) for early adopters

**launch-month token economics (projected):**

| metric | monthly estimate |
|--------|-----------------|
| 200 free users × 3 plans/month | 600 plans → $132-336/mo API |
| 20 paid users × ~8 plans/month | 160 plans → $35-90/mo API |
| **total monthly API cost** | **$167-426** |
| **monthly revenue (20 × $12)** | **$240** |

*margins are thin at launch. Sonnet-for-parse optimization (40-50% cost reduction on parse step) should be implemented before launch. breakeven at ~35 paid faculty users.*

**phase 5 — growth (Q4 2026 → Q1 2027)**

- iterate on pricing based on conversion data and usage patterns
- department tier ($49/month, 10 seats) for chairs/programme leads
- IMS Common Cartridge export for richer LMS interop
- case studies from pilot and early-adopter faculty

**phase 6 — institutional (2027)**

- LTI 1.3 integration for Canvas, Blackboard, Moodle
- institutional tier (custom pricing, SSO, dedicated support)
- pilot with 2-3 institutions from wv's consulting network
- apply for ed-tech grants (Gates Foundation, EDUCAUSE)

**phase 7 — platform (2027-2028)**

- API for third-party integrations
- assessment analytics dashboard (programme-level alignment gaps)
- peer review workflow (faculty review each other's assessments)
- expand to K-12 with standards integration

### unit economics (projected, launch august 2026)

*year 1 = august 2026 → july 2027. years are launch-relative, not calendar.*

| metric | year 1 | year 2 | year 3 |
|--------|--------|--------|--------|
| free users | 500 | 2,000 | 5,000 |
| paid faculty | 50 | 300 | 1,000 |
| department licences | 5 | 25 | 80 |
| institutional licences | 0 | 3 | 10 |
| MRR | $845 | $5,585 | $20,735 |
| ARR | $10,140 | $67,020 | $248,820 |

**revenue breakdown (year 1 end):**
- 50 faculty × $12/mo = $600/mo
- 5 departments × $49/mo = $245/mo
- total MRR: $845

**cost structure:**
- Claude API: ~$0.02-0.05 per plan parse + ~$0.05-0.15 per task generation (opus for quality)
- estimated API cost per active user: $2-5/month at moderate usage (optimized with Sonnet parse: $1.50-3.50)
- Vercel hosting: currently free tier; Pro ($20/month) when traffic warrants
- Neon Postgres: free tier covers pilot + early launch; Pro ($19/month) at ~10K stored plans
- Stripe fees: 2.9% + $0.30 per transaction
- total infrastructure cost year 1: ~$3,500-6,000

**margin note:** at $12/month per faculty user with $2-4/month API cost (Sonnet parse optimized), gross margin is 67-83%. department licences have even better per-seat margins. breakeven (API costs covered by revenue) at ~35 paid faculty users.

**key milestone:** breakeven at ~35 paid faculty — target by month 6 (february 2027).

### token economics

| operation | model | input tokens (est.) | output tokens (est.) | cost per call |
|-----------|-------|--------------------|--------------------|--------------|
| plan parse (objectives extraction) | claude-opus-4-6 | ~2,000-5,000 | ~500-1,500 | $0.02-0.06 |
| task generation (per objective) | claude-opus-4-6 | ~1,500-3,000 | ~1,000-2,500 | $0.04-0.10 |
| typical plan (5 objectives, full generation) | claude-opus-4-6 | ~10,000-20,000 | ~6,000-14,000 | $0.22-0.56 |

*based on Claude Opus 4.6 pricing: $15/M input, $75/M output tokens. costs decrease if sonnet is viable for parse step.*

**cost optimisation levers:**
- use claude-sonnet-4-6 for parse step — **implement before launch (july 2026)**. classification is well-structured, doesn't need opus reasoning. estimated 40-50% cost reduction on parse step.
- cache common Bloom's level → format mappings to reduce redundant generation
- batch objectives in a single generation call where appropriate
- monitor per-user API spend during pilot (april-june) to validate cost model before pricing goes live

### risks and mitigations

| risk | likelihood | impact | mitigation |
|------|-----------|--------|------------|
| AI hallucination in rubric criteria | medium | high | human-in-the-loop review; faculty always edit before use |
| LLM cost spikes | low | medium | usage caps on free tier; cache common patterns; model flexibility |
| slow institutional sales cycle | high | medium | freemium bottom-up adoption; faculty advocates drive institutional interest |
| competitor copies methodology | medium | low | execution speed; brand trust; publish methodology openly (academic credibility) |
| faculty resistance to AI tools | medium | medium | position as "AI-assisted, not AI-replaced"; faculty controls all parameters |

### alignment with winded.vertigo mission

depth.chart embodies wv's core values:
- **play**: faculty experiment with different assessment formats and authenticity weightings
- **justice**: structurally better assessments serve all students, especially those disadvantaged by traditional testing
- **aliveness**: evaluative judgment scaffolds help students develop agency over their own learning

it follows the find → fold → unfold → find again methodology:
- **find**: extract what's already in the lesson plan (objectives, implicit cognitive targets)
- **fold**: shape those objectives into constructively aligned assessment tasks
- **unfold**: the EJ scaffold surfaces what changed — helping students reflect on their own growth
- **find again**: plan history and analytics carry learning forward across courses and semesters

---

## open questions

- [ ] should depth.chart have its own subdomain (depthchart.windedvertigo.com) or stay under the harbour? — *decide before august launch; subdomain aids SEO and brand identity*
- [x] what's the right model split? — **Sonnet for parse, Opus for generation.** implement Sonnet parse before launch (july 2026). monitor quality during pilot.
- [ ] should we pursue SOC 2 compliance early for institutional sales, or wait until there's demand? — *defer to phase 6 (2027), unless a pilot institution requires it*
- [ ] how do we handle FERPA considerations if/when student data enters the system via LTI? — *defer to phase 6; no student data in the system until LTI ships*
- [ ] should the business plan target VC funding or bootstrap via wv's consulting revenue? — *bootstrap through launch; re-evaluate if ARR exceeds $50K*
- [ ] pilot recruitment: who are the 10-15 faculty? — *source from wv's consulting network by end of march*
- [ ] auth provider choice: Google-only or also email magic link? — *decide during pilot prep (march)*
- [ ] database: separate Neon project or shared with creaseworks? — *separate project recommended for isolation*

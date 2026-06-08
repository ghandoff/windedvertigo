# claude code prompt: build "the weave" — real-time collaborative workshop app

> paste this into a Claude Code session in ~/Projects/windedvertigo

---

## context

winded.vertigo builds bespoke interactive apps to facilitate workshops and whirlpool sessions. today we need a new one: "the weave" — a real-time collaborative tool for a session between the w.v collective and lightbulb learning lab (sarah wolman + lisa prince).

the app guides 6-10 participants through a structured agenda with interactive prompts at each phase. everyone joins via a link on their device, the facilitator controls which phase is active, and responses appear in real-time on a shared screen. after the session, the captured content persists as a revisitable artefact.

the name references the nicasio retreat: "birth is this creation of something woven together."

## where it lives

deploy as static files at `site/public/tools/the-weave/index.html` (+ any supporting files). this will be served by the existing wv-site cloudflare worker at `windedvertigo.com/tools/the-weave/`.

## real-time backend: supabase

use the existing supabase instance (the port app already uses it). you'll need:

### tables to create

run these in supabase SQL editor or via a migration:

```sql
-- sessions table
create table weave_sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  title text not null default 'the weave',
  active_phase integer not null default 0,
  phase_revealed boolean not null default false,
  created_at timestamptz not null default now(),
  facilitator_name text,
  config jsonb default '{}'::jsonb
);

-- participants table
create table weave_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references weave_sessions(id) on delete cascade,
  name text not null,
  role text, -- 'facilitator', 'wv', 'lightbulb', 'guest'
  org text, -- 'winded.vertigo', 'lightbulb learning lab'
  joined_at timestamptz not null default now(),
  unique(session_id, name)
);

-- responses table (all phases)
create table weave_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references weave_sessions(id) on delete cascade,
  participant_id uuid references weave_participants(id) on delete cascade,
  phase integer not null,
  response_type text not null, -- 'polaroid', 'spark', 'annotation', 'overlap_item', 'upvote', 'connection', 'commitment', 'close'
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- enable real-time on all three tables
alter publication supabase_realtime add table weave_sessions;
alter publication supabase_realtime add table weave_participants;
alter publication supabase_realtime add table weave_responses;

-- RLS policies (anon key access for the workshop)
alter table weave_sessions enable row level security;
alter table weave_participants enable row level security;
alter table weave_responses enable row level security;

create policy "anyone can read sessions" on weave_sessions for select using (true);
create policy "anyone can create sessions" on weave_sessions for insert with check (true);
create policy "anyone can update sessions" on weave_sessions for update using (true);

create policy "anyone can read participants" on weave_participants for select using (true);
create policy "anyone can join" on weave_participants for insert with check (true);

create policy "anyone can read responses" on weave_responses for select using (true);
create policy "anyone can respond" on weave_responses for insert with check (true);
create policy "anyone can update responses" on weave_responses for update using (true);
```

### supabase credentials

the app needs the public anon key (this is safe to expose — it's designed for client-side use with RLS):

```
SUPABASE_URL: check port/.env or port/.env.local for NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY: check port/.env or port/.env.local for NEXT_PUBLIC_SUPABASE_ANON_KEY
```

embed these in the app's config (they're public keys, not secrets).

## the app structure

build as a single HTML file with embedded CSS and JS. load the supabase JS client from CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

### screens

**1. landing / join screen**
- if no room code in URL: show "create session" (facilitator) or "join session" (participant)
- facilitator enters a session title and gets a room code + shareable link
- participants enter room code + their name + their org (dropdown: winded.vertigo / lightbulb learning lab / guest)
- the URL includes the room code: `windedvertigo.com/tools/the-weave/?room=XXXX`
- clean, branded entry. the w.v logo + "the weave" in the header.

**2. waiting room**
- shows connected participants as they join (name + org badge)
- facilitator sees a "begin" button
- subtle ambient animation (a slow weaving/thread visual in the background using CSS)

**3. phase screens (7 phases)**

each phase has:
- a phase indicator (progress bar or step dots at the top)
- the phase title and a brief facilitator-visible description
- the interactive element specific to that phase
- a facilitator-only "next phase" button (hidden for participants)

#### phase 0: the thread
- full-screen atmospheric text. the framing paragraph from the agenda.
- slow fade-in, line by line.
- participant count in the corner.
- no input — just presence.

#### phase 1: one-year polaroid
- prompt: "one thing that's changed about your work in the last year"
- input: a text field (one sentence max ~150 chars) + submit button
- display: responses appear as polaroid-style cards on a shared canvas
  - each card has: the person's name, their org (colour-coded), their sentence
  - cards arrange in a scattered-but-readable layout (CSS grid with slight random rotation transforms)
  - new cards animate in with a gentle fade + slide
- participants see their own card highlighted after submission
- facilitator sees all cards in real-time as they arrive

#### phase 2: show & tell
- two presentation slots: "w.v" and "lightbulb"
- facilitator toggles which side is presenting
- while a side presents, participants on the OTHER side can drop "sparks":
  - preset spark types: "this overlaps with our work" ✦ / "I want to try this" ⚡ / "tell me more" ◉ / custom text
  - sparks appear as small floating markers in the facilitator view, grouped by type
- after both sides present: facilitator reveals the full spark summary

#### phase 3: the conferences page
- an embedded iframe or screenshot of windedvertigo.com/conferences (try iframe first — if blocked by x-frame-options, use a screenshot with overlay)
- prompt: "what jumps out? what's missing? what would a lightbulb version look like?"
- participants type short annotations that appear as positioned sticky notes overlaying the page
- annotations are colour-coded by org
- facilitator can reposition annotations (drag to arrange on the shared view)

#### phase 4: the overlap map
- two columns side by side:
  - left: "what lightbulb needs from w.v" (champagne background)
  - right: "what w.v needs from lightbulb" (teal background)
- pre-seeded items (from the may meeting notes):
  - left column: "marketing support (linkedin, substack, thought leadership)", "digital tools (check-in tools, interactive experiences)", "conference tech (simulators, harbour tools)", "design + social media"
  - right column: "facilitation design (lightbulb way methodology)", "network connections (CMU, civics, lego ecosystem)", "research/MEL collaboration", "show-don't-tell lens for our workshops"
- anyone can:
  - add new items to either column (text input at bottom of each column)
  - upvote existing items (click to +1, show count)
  - draw connections: click an item on the left, then an item on the right, and a line connects them (these become candidate swaps)
- the connections render as subtle curved lines between the two columns (SVG overlay)

#### phase 5: the first swap
- two mirrored commitment cards side by side:
  - left card: "what w.v will do for lightbulb in the next two weeks"
  - right card: "what lightbulb will do for w.v in the next two weeks"
- each card has fields: what (text), who (dropdown of participants from that org), by when (date picker)
- can add multiple commitments per side
- once submitted, commitments render as clean cards with a "locked in" visual treatment
- this is the action-oriented section — make it feel concrete and decisive

#### phase 6: close
- prompt: "what's trying to be born between us?"
- input: a text field (one sentence)
- responses are HIDDEN until the facilitator clicks "reveal"
- on reveal: all responses appear simultaneously in a constellation layout
  - each response is a glowing text node
  - arranged in a loose circle or organic cluster
  - a slow pulse animation on reveal for the "wow" moment
- this is the emotional punctuation — make the reveal feel special

**4. artefact view**
- after the session ends, the URL becomes a read-only artefact
- all phases are visible as scrollable sections
- the polaroids, overlap map with connections, commitments, and close responses are all preserved
- add a subtle "facilitated with the weave by winded.vertigo" footer

### facilitator controls

the facilitator sees a floating control bar (fixed to bottom of screen):
- current phase name + number
- "next phase →" button
- "reveal" button (for phases with hidden responses like the close)
- participant count
- the control bar is only visible to the user who created the session

## design

### brand
- **cadet navy** (#2B4A5F) — primary text, headers, facilitator UI
- **champagne** (#F5E6CC) — backgrounds, card fills, warm accents
- **sienna** (#A0522D) — highlights, active states, spark indicators
- **teal** (#2A9D8F) — secondary accents, lightbulb org colour
- **off-white** (#FAFAF7) — page background
- white (#FFFFFF) — card backgrounds

### typography
- use system fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- all text lowercase per w.v brand
- headings: 600 weight, generous letter-spacing (0.02em)
- body: 400 weight, comfortable line-height (1.6)

### layout
- mobile-first. participants will mostly be on phones.
- the facilitator's view (on a laptop shared to screen) should look great at 1440px
- responsive: works from 375px (phone) to 1920px (projected)
- generous whitespace. never cramped.
- subtle CSS animations: fade-ins, gentle slides, no jank

### the weave motif
- a subtle background pattern of intersecting curved lines (SVG or CSS)
- when participants from different orgs contribute to the same phase, their contributions are visually "woven" — colour threads from each org that intertwine
- don't overdo it — the motif should be atmospheric, not distracting

### header
- w.v logo mark (use the SVG from site/public/ if available, or a clean text "winded.vertigo" wordmark)
- "the weave" as the app title
- session title underneath (e.g., "whirlpool x lightbulb learning lab — 8 june 2026")
- room code displayed small for latecomers to join

## important technical notes

- **no build step.** this is a static HTML/CSS/JS app. no webpack, no react, no npm install. ship one `index.html` file (+ optional separate CSS/JS files if it gets large).
- **supabase real-time subscriptions** are the backbone. subscribe to changes on `weave_responses` filtered by `session_id`. when a new response arrives, render it immediately.
- **facilitator state** (active phase, reveals) is stored in the `weave_sessions` row and updated via supabase. all participants subscribe to session changes to stay in sync.
- **no auth.** this is a workshop tool — participants join with a name and room code. the room code is the "auth." keep it simple.
- **the iframe for the conferences page** may not work if the site sets `X-Frame-Options`. fall back to a screenshot image with annotation overlay. check by loading the iframe first and catching the error.
- **connections in the overlap map** should render as SVG `<path>` elements with bezier curves between the connected items. store connections as pairs of response IDs in the `weave_responses` table.
- **CSS transitions** everywhere instead of JS animations. `transition: all 0.3s ease` on interactive elements. the reveal in phase 6 can use `@keyframes` for the constellation appearance.

## pre-seeded content

seed the overlap map (phase 4) with these items when the session is created:

**lightbulb needs from w.v:**
- marketing support — linkedin, substack, thought leadership content
- digital workshop tools — interactive check-ins, post-engagement measurement
- conference technology — simulators, harbour tools for live events
- design + social media — visual identity, campaign execution

**w.v needs from lightbulb:**
- facilitation methodology — the lightbulb way, community of practice design
- network access — CMU (john baylash), civics (fernanda rain), lego ecosystem
- research/MEL collaboration — belonging + inclusion frameworks for evaluation
- the "show don't tell" lens — applied to w.v's own workshop design

## deployment

after building:

```bash
cd site
npm run deploy:cf
```

this deploys all static files including the new tool. verify at `windedvertigo.com/tools/the-weave/`.

## testing

1. open two browser windows (or phone + laptop)
2. create a session in one, join in the other
3. walk through all 7 phases
4. verify real-time updates appear in both windows
5. verify the artefact view works after the session ends
6. test on a phone screen (375px width)

## stretch goals (only if time allows)

- **export:** a "download PDF" button on the artefact view that captures the full session as a printable document
- **sound:** a subtle chime when new responses arrive (muted by default, toggle in facilitator controls)
- **QR code:** generate a QR code on the landing screen so the facilitator can project it and participants scan to join

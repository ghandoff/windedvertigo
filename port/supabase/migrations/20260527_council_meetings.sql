-- Council — meeting records, action items, decisions, transcripts (W1).
--
-- The data spine for /council and the wv-claw Council tools. Sourced from
-- multiple capture surfaces (in-browser /transcribe, Google Meet AI in
-- Drive, Plaud uploads, Recall.ai bots, manual paste) that all normalize
-- into the same shape before landing here.
--
-- Notion safety net: lib/meeting-ingest/ingest-meeting-notes.ts continues
-- to write meeting actions to Notion work_items for ~2 weeks of trial. The
-- new ingestToSupabase() path lands rows here in parallel.
--
-- Linking model: meetings link to GCal events via gcal_event_id (W4 adds
-- the GCal pre-create flow). Action items will later FK to work_items.
-- Decisions reference project / deal by id text; FKs deferred to a follow-
-- up migration so we don't block on schema fights tonight.

-- ── meetings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Google Calendar event id when this meeting was pre-created from GCal.
  -- NULL for ad-hoc captures (in-browser /transcribe, manual paste).
  gcal_event_id   TEXT,
  title           TEXT NOT NULL,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  -- Capture surface — useful for diagnostics + per-source quality tracking.
  captured_via    TEXT NOT NULL CHECK (captured_via IN (
                    'in-browser', 'google-meet', 'plaud', 'recall', 'manual', 'notion-legacy'
                  )),
  -- AI-generated 2-3 sentence overview, set at ingest time.
  summary         TEXT,
  organizer_email TEXT,
  attendee_emails TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS meetings_started_idx
  ON meetings (started_at DESC NULLS LAST);

-- Lookup by GCal event id (for the W4 pre-create → ingest matching path).
CREATE UNIQUE INDEX IF NOT EXISTS meetings_gcal_event_idx
  ON meetings (gcal_event_id) WHERE gcal_event_id IS NOT NULL;

-- ── meeting_action_items ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  -- Owner resolved from extractMeetingActions() output. Email may be NULL
  -- when name resolution fails (no match in members table).
  owner_email   TEXT,
  owner_name    TEXT,
  deadline      DATE,
  priority      TEXT CHECK (priority IN ('low', 'medium', 'high')),
  -- Type maps to lib/notion/types WorkItemType for compatibility when the
  -- action gets promoted to a work_item.
  type          TEXT CHECK (type IN ('plan', 'implement', 'coordinate', 'review', 'admin')),
  context       TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  -- When the action is promoted to a Notion work_item, store the page id
  -- here so we can cross-reference and avoid duplicate creation on re-ingest.
  work_item_id  TEXT
);

CREATE INDEX IF NOT EXISTS meeting_action_items_meeting_idx
  ON meeting_action_items (meeting_id);

-- "my open actions" view — dominant query for the council UI.
CREATE INDEX IF NOT EXISTS meeting_action_items_owner_status_idx
  ON meeting_action_items (owner_email, status, deadline NULLS LAST);

-- ── meeting_decisions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meeting_decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  decision_text TEXT NOT NULL,
  context       TEXT,
  -- Loose-link references — FKs added in a follow-up after we settle the
  -- joining logic with existing projects + deals tables.
  project_id    TEXT,
  deal_id       TEXT
);

CREATE INDEX IF NOT EXISTS meeting_decisions_meeting_idx
  ON meeting_decisions (meeting_id);

-- ── meeting_transcripts ─────────────────────────────────────────────────
-- Stored as JSONB segments — searchable via plain text now, semantic
-- search (pgvector) deferred until W4 if transcript-find demand emerges.

CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  -- Each element: { ts: "00:01:23" | seconds, speaker: "lamis", text: "…" }
  segments    JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS meeting_transcripts_meeting_idx
  ON meeting_transcripts (meeting_id);

-- ── docs ────────────────────────────────────────────────────────────────

COMMENT ON TABLE meetings IS 'Council meeting records. One row per captured meeting regardless of source surface.';
COMMENT ON TABLE meeting_action_items IS 'Action items extracted from meeting summaries. The /council "My Actions" tab reads from here.';
COMMENT ON TABLE meeting_decisions IS 'Decisions logged from meetings. Separate from action items because decisions get referenced later.';
COMMENT ON TABLE meeting_transcripts IS 'Raw transcript segments — "warm blanket" use; rarely read, often searched.';

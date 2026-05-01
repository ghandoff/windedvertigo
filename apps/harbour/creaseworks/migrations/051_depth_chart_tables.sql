-- migration: 051_depth_chart_tables
-- description: add depth-chart app tables to the shared harbour database.
--   depth-chart previously used a separate Neon project; this migration
--   brings its tables into the shared DB so SSO + shared entitlements work.
--
--   tables are prefixed with dc_ to avoid collisions with existing tables.
--   the shared users/accounts/verification_token tables are reused directly.
--
--   depth-chart's old schema used TEXT ids (gen_random_uuid()::text).
--   the shared DB uses UUID ids. dc_ tables use UUID to match.

-- add institution column to shared users table (depth-chart feature)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS institution TEXT;

-- ── dc_plans (lesson plans) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dc_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT,
  subject         TEXT,
  grade_level     TEXT,
  raw_text        TEXT NOT NULL,
  source_format   TEXT DEFAULT 'text',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_plans_user ON dc_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_dc_plans_created ON dc_plans(created_at DESC);

-- ── dc_objectives (learning objectives) ─────────────────────────────
CREATE TABLE IF NOT EXISTS dc_objectives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID NOT NULL REFERENCES dc_plans(id) ON DELETE CASCADE,
  raw_text            TEXT NOT NULL,
  cognitive_verb      TEXT,
  blooms_level        TEXT NOT NULL,
  knowledge_dimension TEXT,
  content_topic       TEXT,
  context             TEXT,
  confidence          REAL,
  sort_order          INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dc_objectives_plan ON dc_objectives(plan_id);

-- ── dc_tasks (generated assessment tasks) ───────────────────────────
CREATE TABLE IF NOT EXISTS dc_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id        UUID NOT NULL REFERENCES dc_objectives(id) ON DELETE CASCADE,
  blooms_level        TEXT NOT NULL,
  task_format         TEXT NOT NULL,
  prompt_text         TEXT NOT NULL,
  time_estimate_min   INT,
  collaboration_mode  TEXT,
  rubric_json         JSONB,
  ej_scaffold_json    JSONB,
  authenticity_json   JSONB,
  reliability_notes   TEXT[],
  generation_attempts INT DEFAULT 1,
  authenticity_passed BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_tasks_objective ON dc_tasks(objective_id);

-- ── dc_feedback (task ratings) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS dc_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  task_id     UUID REFERENCES dc_tasks(id) ON DELETE CASCADE,
  plan_id     UUID REFERENCES dc_plans(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_feedback_plan ON dc_feedback(plan_id);
CREATE INDEX IF NOT EXISTS idx_dc_feedback_user ON dc_feedback(user_id);

-- ── dc_usage_events (telemetry) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS dc_usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_usage_user ON dc_usage_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_dc_usage_created ON dc_usage_events(created_at DESC);

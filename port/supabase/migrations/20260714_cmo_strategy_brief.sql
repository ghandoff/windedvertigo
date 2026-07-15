-- editable, version-tracked "strategy brief" tab on /mo — the port's first
-- human write-UI. See docs/prompts/strategy-brief-tab-port-build.md.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

-- the live document (one row per slug; 'current' is the active brief)
CREATE TABLE IF NOT EXISTS cmo_strategy_brief (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE DEFAULT 'current',
  title       text NOT NULL DEFAULT 'strategy brief',
  content     jsonb NOT NULL,
  version     int  NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'active',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL
);

-- append-only version history (snapshot on every save)
CREATE TABLE IF NOT EXISTS cmo_strategy_brief_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id    uuid NOT NULL REFERENCES cmo_strategy_brief(id) ON DELETE CASCADE,
  version     int  NOT NULL,
  content     jsonb NOT NULL,
  change_note text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text NOT NULL,
  UNIQUE (brief_id, version)
);

CREATE INDEX IF NOT EXISTS cmo_strategy_brief_versions_brief_idx
  ON cmo_strategy_brief_versions (brief_id, version DESC);

-- Service-role-only, same pattern as biz_decisions/ttoc_scorecards: RLS
-- enabled, no policies. Only lib/supabase/client.ts's service-role client
-- (which bypasses RLS) touches these tables — the API routes are the only
-- access path, gated by NextAuth session (writes) or CMO_API_TOKEN (agent read).
ALTER TABLE public.cmo_strategy_brief ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmo_strategy_brief_versions ENABLE ROW LEVEL SECURITY;

-- Atomic versioned save: bump version, snapshot into _versions, update the
-- live row — all in one function call (Postgres runs a plpgsql function body
-- as a single implicit transaction, so this can't half-apply). Mirrors the
-- codebase's existing RPC convention (port_analytics_daily,
-- increment_template_times_used) rather than sequential client-side calls,
-- since the spec calls for atomicity here specifically ("in one transaction").
--
-- p_brief_id NULL → create the 'current' brief if it doesn't exist yet
-- (first-ever save). Returns the new version number.
CREATE OR REPLACE FUNCTION save_strategy_brief_version(
  p_slug        text,
  p_content     jsonb,
  p_updated_by  text,
  p_change_note text DEFAULT NULL,
  p_title       text DEFAULT 'strategy brief'
)
RETURNS TABLE (id uuid, version int)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id      uuid;
  v_version int;
BEGIN
  SELECT cmo_strategy_brief.id, cmo_strategy_brief.version
    INTO v_id, v_version
    FROM cmo_strategy_brief
    WHERE slug = p_slug
    FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO cmo_strategy_brief (slug, title, content, version, updated_by)
    VALUES (p_slug, p_title, p_content, 1, p_updated_by)
    RETURNING cmo_strategy_brief.id, cmo_strategy_brief.version INTO v_id, v_version;
  ELSE
    v_version := v_version + 1;
    UPDATE cmo_strategy_brief
      SET content = p_content, version = v_version, updated_at = now(), updated_by = p_updated_by
      WHERE cmo_strategy_brief.id = v_id;
  END IF;

  INSERT INTO cmo_strategy_brief_versions (brief_id, version, content, change_note, created_by)
  VALUES (v_id, v_version, p_content, p_change_note, p_updated_by);

  RETURN QUERY SELECT v_id, v_version;
END;
$$;

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('cmo_strategy_brief', 'cmo_strategy_brief_versions')
-- ORDER BY table_name, ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS save_strategy_brief_version(text, jsonb, text, text, text);
-- DROP TABLE IF EXISTS cmo_strategy_brief_versions;
-- DROP TABLE IF EXISTS cmo_strategy_brief;

-- upgrade the /mo "timeline" tab into a multi-view Gantt — one item set,
-- several toggle-able groupings (by workstream / owner / horizon / mission
-- vs survival). See docs/prompts/strategy-brief-tab-port-build.md, section
-- "timeline tab — multiple toggle-able Gantt views".
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS cmo_timeline_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  lane        text NOT NULL,               -- workstream, e.g. 'consortium / IDB'
  owner       text,                        -- 'garrett' | 'lamis' | 'maria' | 'jamie' | 'payton' | agent
  horizon     text,                        -- 'now' | 'q3-2026' | '2027'
  track       text,                        -- 'mission' | 'survival' | 'neutral'
  kind        text NOT NULL DEFAULT 'task'
    CONSTRAINT cmo_timeline_items_kind_check
      CHECK (kind IN ('task', 'milestone', 'critical', 'active')),
  start_date  date NOT NULL,
  end_date    date,                        -- null for point-in-time milestones
  sort        int  NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL
);

-- fast lookup for the "by workstream" (default) view + stable ordering
CREATE INDEX IF NOT EXISTS cmo_timeline_items_lane_sort_idx
  ON cmo_timeline_items (lane, sort);

-- Service-role-only, same pattern as cmo_strategy_brief: RLS enabled, no
-- policies. Only lib/supabase/client.ts's service-role client (which
-- bypasses RLS) touches this table — /api/cmo/timeline-items is the only
-- access path, gated by NextAuth session (read) or CMO_API_TOKEN (agent
-- read + seed writes; no in-UI editing in v1, per the spec).
ALTER TABLE public.cmo_timeline_items ENABLE ROW LEVEL SECURITY;

COMMIT;

-- NOTE — no seed data. The spec asks to seed from the "strategy-log-2026-06-30"
-- Mermaid Gantt / docs/cmo/decisions-log.md, but neither the artifact nor a
-- 2026-06-30 decisions-log entry exists anywhere in this repo (checked
-- docs/cmo/decisions-log.md, docs/cmo/strategy.md, docs/cmo/weekly-log.md —
-- June 30 only appears as a *future* planned QBR / Nordic-close date, never
-- as a Gantt source). Same situation the strategy-brief-tab PR (#388) hit for
-- its own seed content. The table launches empty; the UI renders a "no items
-- yet" empty state and the four views + lane toggles are fully wired for
-- whenever Mo (bearer token) or Garrett seeds real items via
-- POST /api/cmo/timeline-items.

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'cmo_timeline_items'
-- ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP INDEX IF EXISTS cmo_timeline_items_lane_sort_idx;
-- DROP TABLE IF EXISTS cmo_timeline_items;

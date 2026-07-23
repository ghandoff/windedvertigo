-- knowledge graph — unified human (Notion CV) + agent (live logs) + curated graph
-- Apply via the Supabase Management API (wv-port-pilot) — NEVER `supabase db push`.
-- Two tables; every row carries provenance (kind + source) so the /brain viz can
-- colour human/agent/shared and back-traverse to its origin.

BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id             text        PRIMARY KEY,                 -- deterministic, e.g.
                                                          --   "cv:skill:<notion_page_id>",
                                                          --   "agent:carl", "obs:carl_finding:<uuid>",
                                                          --   "concept:<canonical_key>", curated ids
  kind           text        NOT NULL DEFAULT 'agent'
    CONSTRAINT knowledge_nodes_kind_check CHECK (kind IN ('human','agent','shared')),
  category       text        NOT NULL,                    -- member|skill|method|framework|population|
                                                          --   service|cv-entry|concept|agent|...
  label          text        NOT NULL,
  canonical_key  text        NOT NULL,                    -- normalized label for cross-source dedup
  source         text        NOT NULL
    CONSTRAINT knowledge_nodes_source_check CHECK (source IN ('notion-cv','agent-log','curated','derived')),
  source_ref     text        NULL,                        -- notion page URL / table:uuid / const
  description    text        NULL,
  attrs          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_nodes_kind_idx      ON knowledge_nodes (kind);
CREATE INDEX IF NOT EXISTS knowledge_nodes_category_idx  ON knowledge_nodes (category);
CREATE INDEX IF NOT EXISTS knowledge_nodes_source_idx    ON knowledge_nodes (source);
CREATE INDEX IF NOT EXISTS knowledge_nodes_canonical_idx ON knowledge_nodes (canonical_key);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     text        NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_id     text        NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relationship  text        NOT NULL,                     -- holds-skill|demonstrates|uses-method|
                                                          --   applies-framework|serves-population|
                                                          --   offers|led-by|observed|same-as|...
  source        text        NOT NULL
    CONSTRAINT knowledge_edges_source_check CHECK (source IN ('notion-cv','agent-log','curated','derived')),
  source_ref    text        NULL,
  attrs         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_edges_unique UNIQUE (source_id, target_id, relationship, source)
);

CREATE INDEX IF NOT EXISTS knowledge_edges_source_id_idx ON knowledge_edges (source_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_target_id_idx ON knowledge_edges (target_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_rel_idx       ON knowledge_edges (relationship);

COMMIT;

-- ── DRY-RUN (preview after apply) ────────────────────────────────────────────
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('knowledge_nodes','knowledge_edges')
-- ORDER BY table_name, ordinal_position;

-- ── ROLLBACK (run only to undo) ──────────────────────────────────────────────
-- DROP TABLE IF EXISTS knowledge_edges;
-- DROP TABLE IF EXISTS knowledge_nodes;

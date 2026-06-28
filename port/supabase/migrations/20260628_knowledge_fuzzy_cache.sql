-- knowledge graph — fuzzy reconciliation verdict cache.
-- Apply via the Supabase Management API (wv-port-pilot) — NEVER `supabase db push`.
--
-- One row per adjudicated canonical-key PAIR (keyed by key, not node id, so it
-- survives concept re-extraction). Keeps the fuzzy human↔agent bridges stable
-- across daily syncs and means each pair is judged by Haiku at most once.

BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_fuzzy_cache (
  key_a       text        NOT NULL,           -- canonical keys, stored sorted (key_a <= key_b)
  key_b       text        NOT NULL,
  same        boolean     NOT NULL,
  confidence  numeric     NOT NULL DEFAULT 0,
  judged_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_fuzzy_cache_pair UNIQUE (key_a, key_b)
);

CREATE INDEX IF NOT EXISTS knowledge_fuzzy_cache_same_idx ON knowledge_fuzzy_cache (same);

COMMIT;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS knowledge_fuzzy_cache;

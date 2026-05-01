-- Migration 006: Add index on runs_cache.run_date
-- Speeds up date-range queries on the runs page.
-- Audit finding M4.

CREATE INDEX IF NOT EXISTS idx_runs_date ON runs_cache(run_date);

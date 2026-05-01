-- Migration 007: persistent rate limiting table.
--
-- Session 12: replace in-memory token bucket with a Postgres-backed
-- sliding window counter that survives cold starts and works across
-- all serverless instances.
--
-- Each row is a (key, window_start) pair with a hit counter.
-- The proxy increments the counter on each API request and checks
-- whether it exceeds the allowed limit. Old windows are cleaned up
-- periodically (either via a lightweight inline prune or cron).

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- Index for cleanup queries (prune windows older than N minutes)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits (window_start);

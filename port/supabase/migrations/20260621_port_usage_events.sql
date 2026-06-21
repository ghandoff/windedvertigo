-- Port page-view tracking: records which authenticated user visited which path.
-- Lightweight — one row per navigation, power users become visible immediately.
CREATE TABLE IF NOT EXISTS port_usage_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  path       TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS port_usage_events_user_email_idx ON port_usage_events (user_email);
CREATE INDEX IF NOT EXISTS port_usage_events_visited_at_idx ON port_usage_events (visited_at DESC);
CREATE INDEX IF NOT EXISTS port_usage_events_path_idx ON port_usage_events (path);

-- Helper functions used by the analytics page

CREATE OR REPLACE FUNCTION port_analytics_top_paths(since_ts TIMESTAMPTZ, limit_n INT DEFAULT 20)
RETURNS TABLE(path TEXT, count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT path, COUNT(*) AS count
  FROM port_usage_events
  WHERE visited_at >= since_ts
  GROUP BY path
  ORDER BY count DESC
  LIMIT limit_n;
$$;

CREATE OR REPLACE FUNCTION port_analytics_per_user(since_ts TIMESTAMPTZ)
RETURNS TABLE(user_email TEXT, count BIGINT, last_seen TIMESTAMPTZ)
LANGUAGE SQL STABLE AS $$
  SELECT user_email, COUNT(*) AS count, MAX(visited_at) AS last_seen
  FROM port_usage_events
  WHERE visited_at >= since_ts
  GROUP BY user_email
  ORDER BY count DESC;
$$;

CREATE OR REPLACE FUNCTION port_analytics_daily(since_ts TIMESTAMPTZ)
RETURNS TABLE(date TEXT, count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT TO_CHAR(DATE_TRUNC('day', visited_at AT TIME ZONE 'America/Los_Angeles'), 'YYYY-MM-DD') AS date,
         COUNT(*) AS count
  FROM port_usage_events
  WHERE visited_at >= since_ts
  GROUP BY DATE_TRUNC('day', visited_at AT TIME ZONE 'America/Los_Angeles')
  ORDER BY date ASC;
$$;

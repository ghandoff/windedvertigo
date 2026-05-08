-- Manual-entry social-metrics log.
--
-- Phase 1 of the social-media analytics integration (see
-- port/docs/social-media-integration-plan.md). Lets payton/lamis/garrett
-- enter follower counts + post engagement weekly without waiting for the
-- meta + linkedin + substack api integrations to be approved + wired.
--
-- Read path: getLatestSocialMetrics(platform) returns the latest row per
-- metric_key. The KpiSourceModal + getSocialStatsFromSnapshot overlay
-- these on top of the cron-snapshot API data so the KPI tiles stay live
-- even when the platform integrations are NULL.

CREATE TABLE IF NOT EXISTS social_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- platform discriminator. allowed values are constrained at the schema
  -- level so a typo can't pollute the read path.
  platform        TEXT NOT NULL CHECK (platform IN (
                    'substack', 'linkedin', 'instagram',
                    'facebook', 'bluesky', 'tiktok'
                  )),
  -- per-platform metric key. examples:
  --   substack:  'subscribers'
  --   linkedin:  'followers' | 'posts_published' | 'recent_engagement'
  --   instagram: 'followers' | 'recent_reach' | 'recent_engagement'
  --   facebook:  'page_followers' | 'recent_engagement'
  metric_key      TEXT NOT NULL,
  value           INTEGER NOT NULL CHECK (value >= 0 AND value <= 1000000),
  -- period semantics: every number covers a window. weekly metrics use
  -- monday → sunday. monthly use first → last day. snapshot-only metrics
  -- (e.g. follower count "as of today") set period_start = period_end.
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL CHECK (period_end >= period_start),
  -- provenance. every row knows who entered it + when.
  entered_by_email TEXT NOT NULL,
  entered_by_name  TEXT,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- soft notes the team can leave (e.g. "instagram counted reels separately this week")
  note             TEXT
);

-- "latest entry per (platform, metric_key)" is the dominant query.
-- A composite index keyed by period_end DESC keeps it cheap even at
-- thousands of rows.
CREATE INDEX IF NOT EXISTS social_metrics_latest_idx
  ON social_metrics (platform, metric_key, period_end DESC);

-- "everything entered recently" used by the audit log + stale checks.
CREATE INDEX IF NOT EXISTS social_metrics_entered_idx
  ON social_metrics (entered_at DESC);

COMMENT ON TABLE social_metrics IS
  'Manual-entry social media metrics. Phase 1 of social-stats integration. Overlaid on top of cron-fetched API data in getSocialStatsFromSnapshot at read time. Latest row per (platform, metric_key) wins.';

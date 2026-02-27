-- 027: Campaigns metadata table
-- Stores campaign title, description, and active flag.
-- Campaign slugs are referenced from playdates_cache.campaign_tags[].

CREATE TABLE IF NOT EXISTS campaigns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  description TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed existing campaign
INSERT INTO campaigns (slug, title, description) VALUES
  ('acetate', 'color acetate adventures',
   'you found the acetate trail! these playdates all use color acetate sheets — layer them, hold them up to the light, project them onto walls, and discover what happens when colors overlap.')
ON CONFLICT (slug) DO NOTHING;

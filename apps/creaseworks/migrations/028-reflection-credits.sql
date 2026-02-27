-- Migration 028: Reflection credits & redemptions
--
-- Credits are earned by logging reflections, adding photos,
-- consenting to marketing, completing find-again rounds, and
-- maintaining streaks. Credits can be spent on sampler PDFs,
-- individual playdates, or full packs.

CREATE TABLE reflection_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id TEXT,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,  -- quick_log | photo_added | marketing_consent | find_again | streak_bonus
  run_id UUID REFERENCES runs_cache(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_credits_user ON reflection_credits(user_id);
CREATE INDEX idx_credits_org ON reflection_credits(org_id);
CREATE INDEX idx_credits_created ON reflection_credits(created_at DESC);

CREATE TABLE credit_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id TEXT,
  credits_spent INTEGER NOT NULL,
  reward_type TEXT NOT NULL,  -- sampler_pdf | single_playdate | full_pack
  reward_ref TEXT,            -- pack slug or playdate slug
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_redemptions_user ON credit_redemptions(user_id);

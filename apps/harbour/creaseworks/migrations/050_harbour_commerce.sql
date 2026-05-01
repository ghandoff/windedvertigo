-- migration: 050_harbour_commerce
-- description: extend commerce tables for cross-app harbour purchases.
--   - add app column to packs_catalogue for multi-app pack identification
--   - add stripe_customer_id to users for individual (non-org) purchases
--   - allow org-less purchases (individual users)
--   - add app column to purchases for cross-app reporting
--   - add product_type to packs_catalogue (pack, bundle, subscription)

-- 1. App column on packs_catalogue — identifies which harbour app owns the pack
ALTER TABLE packs_catalogue
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'creaseworks';

-- 2. Product type — 'pack' (single app), 'bundle' (cross-app), 'subscription' (future)
ALTER TABLE packs_catalogue
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'pack';

-- 3. Stripe customer ID on users — for individual purchases without an org
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
  ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 4. Allow org-less purchases (individual users buying from any app)
ALTER TABLE purchases
  ALTER COLUMN org_id DROP NOT NULL;

-- 5. App column on purchases — tracks which app processed the purchase
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'creaseworks';

-- 6. User ID on purchases — for individual purchases, always set
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Backfill user_id from purchaser_id for existing rows
UPDATE purchases SET user_id = purchaser_id WHERE user_id IS NULL;

-- 7. Update existing vault packs to reflect their app
UPDATE packs_catalogue
  SET app = 'vertigo-vault'
  WHERE pack_cache_id IN (
    SELECT id FROM packs_cache WHERE slug IN ('vault-explorer', 'vault-practitioner')
  );

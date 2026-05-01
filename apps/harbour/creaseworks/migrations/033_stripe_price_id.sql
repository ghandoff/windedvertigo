-- 033: add stripe_price_id column to packs_catalogue
--
-- Stores the Stripe Price object ID so checkout uses a reusable
-- price instead of creating an ad-hoc price_data every time.
-- The checkout route already reads this column (nullable / optional).

ALTER TABLE packs_catalogue
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Seed known Stripe test-mode prices.
-- classroom starter  → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T5EZ2D50swbC2DglU1gwqio'
  WHERE pack_cache_id = '91753e91-54eb-43ad-a9ab-e4fdc015ae08' AND stripe_price_id IS NULL;
-- new baby sibling   → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T5EZ3D50swbC2Dgl1hyJoy5'
  WHERE pack_cache_id = '36f5e2d2-39f8-4fa5-8419-8435a19f5023' AND stripe_price_id IS NULL;
-- rainy day rescue   → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T5EZ4D50swbC2DgddSTnMgt'
  WHERE pack_cache_id = '9419aa6d-7fc2-4699-a78d-cbf8547c0fee' AND stripe_price_id IS NULL;
-- summer play camp   → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T5EZ5D50swbC2DglQtrSnbg'
  WHERE pack_cache_id = '03eaa0b6-c4fa-4fb2-b16e-69970e4f9910' AND stripe_price_id IS NULL;
-- the whole collection → $14.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T5EZ6D50swbC2DgpaTfaJ3N'
  WHERE pack_cache_id = '9f5e9e28-4ab9-4553-8697-88eb80656a91' AND stripe_price_id IS NULL;
-- co-design essentials → $49.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T5bqmD50swbC2DgkKdiEHwH'
  WHERE pack_cache_id = 'b535a022-90c0-4e14-b92b-54a43e7aac76' AND stripe_price_id IS NULL;

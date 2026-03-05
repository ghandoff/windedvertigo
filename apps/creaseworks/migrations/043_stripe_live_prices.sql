-- 043: update packs_catalogue with new Stripe price IDs
--
-- Replaces test-mode price IDs from migration 033 with new prices.
-- These prices were created via Stripe MCP tools (session 49).
-- When switching to live-mode keys, re-create products/prices in
-- the live Stripe dashboard and update this migration accordingly.

-- classroom starter → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T7Cr3D50swbC2DgZ1821EuG'
  WHERE pack_cache_id = '91753e91-54eb-43ad-a9ab-e4fdc015ae08';

-- new baby sibling → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T7Cr6D50swbC2DgLYnzdlh5'
  WHERE pack_cache_id = '36f5e2d2-39f8-4fa5-8419-8435a19f5023';

-- rainy day rescue → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T7Cr8D50swbC2DgDfJdCjWz'
  WHERE pack_cache_id = '9419aa6d-7fc2-4699-a78d-cbf8547c0fee';

-- summer play camp → $4.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T7Cr9D50swbC2Dg5loVo2nU'
  WHERE pack_cache_id = '03eaa0b6-c4fa-4fb2-b16e-69970e4f9910';

-- the whole collection → $14.99
UPDATE packs_catalogue SET stripe_price_id = 'price_1T7CrAD50swbC2Dg1omLIHV9'
  WHERE pack_cache_id = '9f5e9e28-4ab9-4553-8697-88eb80656a91';

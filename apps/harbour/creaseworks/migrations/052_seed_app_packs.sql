-- migration: 052_seed_app_packs
-- description: seed placeholder packs for depth-chart, deep-deck, and raft-house.
--   these are set visible = false until real Stripe Price IDs are attached.
--   also seeds the harbour bundle placeholder.

-- ── depth-chart packs ───────────────────────────────────────────

INSERT INTO packs_cache (id, notion_id, title, description, status, slug)
VALUES (
  'dc000001-0000-0000-0000-000000000001',
  'dc-assessment-pro',
  'assessment pro',
  'unlimited assessment generation, export to LMS formats, and full rubric customisation.',
  'live',
  'dc-assessment-pro'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO packs_catalogue (pack_cache_id, app, product_type, price_cents, currency, visible)
VALUES (
  'dc000001-0000-0000-0000-000000000001',
  'depth-chart',
  'pack',
  999,
  'USD',
  false
) ON CONFLICT DO NOTHING;

-- ── deep-deck packs ─────────────────────────────────────────────

INSERT INTO packs_cache (id, notion_id, title, description, status, slug)
VALUES (
  'dd000001-0000-0000-0000-000000000001',
  'dd-full-deck',
  'full deck',
  'unlock all conversation card decks, custom deck creation, and saved favourites.',
  'live',
  'dd-full-deck'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO packs_catalogue (pack_cache_id, app, product_type, price_cents, currency, visible)
VALUES (
  'dd000001-0000-0000-0000-000000000001',
  'deep-deck',
  'pack',
  799,
  'USD',
  false
) ON CONFLICT DO NOTHING;

-- ── raft-house packs ────────────────────────────────────────────

INSERT INTO packs_cache (id, notion_id, title, description, status, slug)
VALUES (
  'a0f00001-0000-0000-0000-000000000001',
  'rh-host-pro',
  'host pro',
  'create and host unlimited rooms, save session history, export reports, and access advanced activity packs.',
  'live',
  'rh-host-pro'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO packs_catalogue (pack_cache_id, app, product_type, price_cents, currency, visible)
VALUES (
  'a0f00001-0000-0000-0000-000000000001',
  'raft-house',
  'pack',
  999,
  'USD',
  false
) ON CONFLICT DO NOTHING;

-- ── harbour bundle ──────────────────────────────────────────────

INSERT INTO packs_cache (id, notion_id, title, description, status, slug)
VALUES (
  'ab000001-0000-0000-0000-000000000001',
  'harbour-bundle',
  'harbour bundle',
  'full access to all five harbour apps at a bundled price.',
  'live',
  'harbour-bundle'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO packs_catalogue (pack_cache_id, app, product_type, price_cents, currency, visible)
VALUES (
  'ab000001-0000-0000-0000-000000000001',
  'harbour',
  'bundle',
  3499,
  'USD',
  false
) ON CONFLICT DO NOTHING;

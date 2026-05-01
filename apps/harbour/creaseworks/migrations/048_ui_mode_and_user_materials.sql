-- 048: add ui_mode preference + user_materials inventory table
--
-- ui_mode: 'kid' or 'grownup' presentation toggle.
-- user_materials: persistent "my workshop" material inventory.

ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_mode TEXT DEFAULT 'grownup';

CREATE TABLE IF NOT EXISTS user_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials_cache(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_user_materials_user ON user_materials(user_id);

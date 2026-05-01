-- 049: Add materials_used_as JSONB to runs_cache for function evolution tracking.
-- Stores how each material was used (its function) during a playdate run.
-- Schema: [{ "material_id": "uuid", "function_used": "connector", "notes": "..." }]

ALTER TABLE runs_cache ADD COLUMN IF NOT EXISTS materials_used_as JSONB DEFAULT '[]';

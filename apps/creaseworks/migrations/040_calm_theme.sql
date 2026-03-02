-- Migration 040: calm theme preference
--
-- Low-stimulation dark theme for sensory sensitivity (autism spectrum,
-- migraines, ADHD overstimulation). Warm dark backgrounds, desaturated
-- accents, reduced visual contrast. Pairs with reduce_motion for a
-- comprehensive sensory-friendly experience.

ALTER TABLE users ADD COLUMN IF NOT EXISTS calm_theme BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.calm_theme IS 'Low-stimulation dark theme — warm darks, muted accents for sensory sensitivity';

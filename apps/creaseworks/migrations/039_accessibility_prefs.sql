-- Migration 039: accessibility preferences
--
-- App-level toggles that supplement OS-level settings.
-- reduce_motion: disables CSS animations (independent of prefers-reduced-motion)
-- dyslexia_font: switches to Atkinson Hyperlegible for readability

ALTER TABLE users ADD COLUMN IF NOT EXISTS reduce_motion BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dyslexia_font BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.reduce_motion IS 'App-level reduced motion toggle — supplements OS prefers-reduced-motion';
COMMENT ON COLUMN users.dyslexia_font IS 'Switches UI to Atkinson Hyperlegible for dyslexia-friendly reading';

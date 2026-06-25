-- Per-user remembered Aura voice for the listen library.
-- listen_prefs: one row per login → their chosen Aura speaker (syncs across their
-- devices). listen_items.speaker: the voice a given render used (also folded into
-- the dedupe content_hash so changing voice re-renders).

CREATE TABLE IF NOT EXISTS public.listen_prefs (
  user_email TEXT PRIMARY KEY,
  speaker    TEXT NOT NULL DEFAULT 'arcas',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.listen_prefs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.listen_items ADD COLUMN IF NOT EXISTS speaker TEXT;

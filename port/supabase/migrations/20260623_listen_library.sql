-- Listen library: documents rendered to audio for phone playback (Carl reads aloud).
-- listen_items = one queued/rendered document; listen_chunks = its audio segments
-- (chunks play back as a sequential playlist — no server-side concat).
-- RLS-enabled, service-role only (same as biz_*/fin_*/opsy_*).

CREATE TABLE IF NOT EXISTS public.listen_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT NOT NULL DEFAULT 'garrett',
  title       TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('google-doc','upload','url','notion')),
  source_ref  TEXT NOT NULL,                 -- doc id / file name / url / page id
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','rendering','ready','failed')),
  clean_level TEXT NOT NULL DEFAULT 'clean'  CHECK (clean_level IN ('faithful','clean')),
  voice       TEXT NOT NULL DEFAULT 'cartesia', -- TTS provider id (provenance)
  text_key    TEXT,                           -- R2 key of the extracted text the job renders
  char_count  INTEGER,
  est_minutes INTEGER,
  chunk_count INTEGER,
  error       TEXT
);
CREATE INDEX listen_items_created_idx ON public.listen_items (created_at DESC);
CREATE INDEX listen_items_status_idx  ON public.listen_items (status);
CREATE INDEX listen_items_owner_idx   ON public.listen_items (created_by);

CREATE TABLE IF NOT EXISTS public.listen_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.listen_items(id) ON DELETE CASCADE,
  idx         INTEGER NOT NULL,               -- 0-based playback order
  r2_key      TEXT NOT NULL,                  -- audio object key in port-assets
  char_count  INTEGER,
  duration_ms INTEGER,
  UNIQUE (item_id, idx)
);
CREATE INDEX listen_chunks_item_idx ON public.listen_chunks (item_id, idx);

ALTER TABLE public.listen_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listen_chunks ENABLE ROW LEVEL SECURITY;

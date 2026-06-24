-- Listen library cost controls: condensed-listen mode + dedupe cache.
-- condense: render a trimmed "gist" version (LLM pass before TTS).
-- content_hash: sha256(extractedText + clean_level + condense + provider) so an
-- identical re-submission returns the existing render instead of re-paying TTS.

ALTER TABLE public.listen_items
  ADD COLUMN IF NOT EXISTS condense BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS listen_items_hash_idx
  ON public.listen_items (created_by, content_hash);

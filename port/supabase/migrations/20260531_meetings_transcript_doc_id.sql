-- Meet AI transcript ingest — idempotency column.
--
-- The hourly meet-transcript-ingest cron will list Drive files modified in
-- the last day and process new ones. We need to know which Drive Doc fed
-- each meeting row so we can skip already-processed transcripts on rerun.
--
-- Cleaner than a separate `processed_transcripts` table because it keeps
-- the source-of-truth on the meeting itself: querying "did this transcript
-- already ingest?" is a single indexed lookup.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_doc_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS meetings_transcript_doc_idx
  ON meetings (transcript_doc_id) WHERE transcript_doc_id IS NOT NULL;

COMMENT ON COLUMN meetings.transcript_doc_id IS 'Google Drive Doc id of the Meet AI transcript that fed this meeting. Set by the meet-transcript-ingest cron. NULL for non-Meet captures (in-browser, manual, pre-create from gcal-sync).';

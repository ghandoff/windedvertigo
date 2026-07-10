-- 024 — Import-jobs off Notion (2026-07 cutover, Part 3)
-- The article-import pipeline stored rich job fields (pdfUrl, batchId,
-- contentHash, extractedData, …) only in Notion; the extraction runner needs
-- them. This migration adds those columns to pcs_import_jobs so Postgres
-- becomes the single source of truth, plus a trigger-maintained updated_at for
-- the stale-job sweep. Applied to wv-nordic (nzdfpfrnilreqzmthpui) via the
-- Supabase Management API on 2026-07-10.

ALTER TABLE pcs_import_jobs
  ADD COLUMN IF NOT EXISTS job_id text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS existing_doc_id text,
  ADD COLUMN IF NOT EXISTS conflict_action text,
  ADD COLUMN IF NOT EXISTS extracted_data text,
  ADD COLUMN IF NOT EXISTS created_document_id text,
  ADD COLUMN IF NOT EXISTS result_counts text,
  ADD COLUMN IF NOT EXISTS warnings text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_id text,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS notification_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diff_report text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pcs_import_jobs_batch_id ON pcs_import_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_pcs_import_jobs_content_hash ON pcs_import_jobs(content_hash);

DROP TRIGGER IF EXISTS trg_pcs_import_jobs_updated_at ON pcs_import_jobs;
CREATE TRIGGER trg_pcs_import_jobs_updated_at BEFORE UPDATE ON pcs_import_jobs
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- One-shot cleanup: 25 pre-migration jobs were stuck 'queued' with no persisted
-- pdf_url (unrecoverable — created during the broken write-Postgres/read-Notion
-- window). Mark them failed so the runner doesn't spin on fetch(null).
UPDATE pcs_import_jobs
SET status = 'failed',
    error_log = 'Abandoned 2026-07 during the Notion->Postgres import-pipeline migration: orphaned pre-migration queued job whose PDF URL / rich fields were never persisted (unrecoverable). Re-upload the PDF to retry.'
WHERE status = 'queued' AND pdf_url IS NULL;

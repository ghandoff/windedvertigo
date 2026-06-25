-- Bridge: optional link from a PaM commitment to a Notion work_item.
--
-- pam_commitments (this-week plans) and work_items (Notion source-of-truth for
-- shipped work) have different lifespans, so they stay separate tables — but a
-- commitment can now point at the work_item it represents, so the same piece of
-- work stops living in two unsynced places with no thread between them.
--
-- work_item_id holds the work_items.notion_page_id (text), mirroring how
-- meeting_action_items.work_item_id already links to Notion tasks.
--
-- Applied via the Supabase Management API query endpoint (wv-port-pilot has no
-- remote migration ledger — never `supabase db push`).

ALTER TABLE pam_commitments
  ADD COLUMN IF NOT EXISTS work_item_id text;

CREATE INDEX IF NOT EXISTS idx_pam_commitments_work_item_id
  ON pam_commitments (work_item_id);

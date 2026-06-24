-- Council → PaM bridge: review-inbox triage state on meeting_action_items.
--
-- Adds the columns the triage step + promote-to-commitment route need:
--   pam_commitment_id  — back-link to the created pam_commitments row. Doubles
--                        as the idempotency key (mirrors the existing
--                        work_item_id back-link to Notion).
--   triage_state       — drives the PaM review inbox. NULL = not yet triaged;
--                        'pending' awaits human review; 'accepted'/'merged' have
--                        reached the board; 'dismissed' was judged not meaningful.
--   triage_suggestion  — PaM's suggestion blob (suggested cycle, commitment_type,
--                        priority, mergeWith commitment id, reason) so the inbox
--                        renders without re-running the LLM.
--
-- Applied via the Supabase Management API query endpoint (wv-port-pilot has no
-- remote migration ledger — never `supabase db push`).

ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS pam_commitment_id uuid,
  ADD COLUMN IF NOT EXISTS triage_state text
    CHECK (triage_state IN ('pending', 'accepted', 'dismissed', 'merged')),
  ADD COLUMN IF NOT EXISTS triage_suggestion jsonb;

CREATE INDEX IF NOT EXISTS idx_mai_pam_commitment_id
  ON meeting_action_items (pam_commitment_id);

CREATE INDEX IF NOT EXISTS idx_mai_triage_state
  ON meeting_action_items (triage_state);

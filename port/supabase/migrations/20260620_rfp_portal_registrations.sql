-- rfp_portal_registrations — tracks whether wv is registered on the
-- procurement portal a funder uses to accept bids. An unregistered portal
-- is the #1 silent bid-killer (UNGM/UNICEF dead-ends caught at deadline).
--
-- Apply via Supabase SQL editor on wv-port-pilot.

CREATE TABLE IF NOT EXISTS rfp_portal_registrations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id          TEXT        NOT NULL,  -- notion_page_id of rfp_opportunities
  portal_name     TEXT        NOT NULL,  -- e.g. "UNGM", "UNICEF eSourcing", "IDB", "direct"
  -- registered | pending | blocked | not-required
  status          TEXT        NOT NULL DEFAULT 'pending',
  notes           TEXT,
  registered_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rfp_portal_registrations_status_check
    CHECK (status IN ('registered', 'pending', 'blocked', 'not-required')),
  UNIQUE (rfp_id, portal_name)
);

CREATE INDEX IF NOT EXISTS idx_rfp_portal_registrations_rfp_id
  ON rfp_portal_registrations (rfp_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS rfp_portal_registrations_updated_at ON rfp_portal_registrations;
CREATE TRIGGER rfp_portal_registrations_updated_at
  BEFORE UPDATE ON rfp_portal_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

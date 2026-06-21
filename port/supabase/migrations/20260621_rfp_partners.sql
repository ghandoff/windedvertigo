-- rfp_partners — structured record of teaming partners (sub-contractors,
-- consortium members) for international bids (UN, IDB, etc.).
--
-- Apply via Supabase SQL editor on wv-port-pilot.

CREATE TABLE IF NOT EXISTS rfp_partners (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  country       TEXT,           -- ISO country name, e.g. "Kenya", "Uganda"
  type          TEXT        NOT NULL DEFAULT 'local',  -- local | international | academic | government
  capabilities  TEXT[],         -- e.g. ARRAY['MEL', 'curriculum', 'gender']
  relationship  TEXT        NOT NULL DEFAULT 'known',  -- known | nda_signed | ta_on_file | active_sub
  contact_name  TEXT,
  contact_email TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rfp_partners_type_check CHECK (type IN ('local','international','academic','government')),
  CONSTRAINT rfp_partners_relationship_check CHECK (relationship IN ('known','nda_signed','ta_on_file','active_sub'))
);

CREATE INDEX IF NOT EXISTS idx_rfp_partners_country ON rfp_partners (country);

-- updated_at trigger (reuse the shared function defined in 20260620_rfp_portal_registrations.sql)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS rfp_partners_updated_at ON rfp_partners;
CREATE TRIGGER rfp_partners_updated_at
  BEFORE UPDATE ON rfp_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

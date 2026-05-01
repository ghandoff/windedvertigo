-- Phase G.1.2 — add missing filter columns to contacts table.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS contact_warmth       text,
  ADD COLUMN IF NOT EXISTS responsiveness       text,
  ADD COLUMN IF NOT EXISTS referral_potential   boolean;

-- Trigram index for ILIKE search on name
CREATE INDEX IF NOT EXISTS contacts_name_trgm_idx ON contacts USING gin (name gin_trgm_ops);

-- B-tree indexes for new filter columns
CREATE INDEX IF NOT EXISTS contacts_warmth_idx       ON contacts (contact_warmth);
CREATE INDEX IF NOT EXISTS contacts_responsiveness_idx ON contacts (responsiveness);

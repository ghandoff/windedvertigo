-- Fin: CFO agent for Winded Vertigo LLC + garrett personal finances
-- Tables: fin_items, fin_decisions, fin_patterns, fin_snapshots, fin_memory
-- All RLS-enabled with no public policies — service-role only.

-- action-required items (bills, deadlines, tax notices, renewals, alerts)
CREATE TABLE IF NOT EXISTS public.fin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('bill','invoice','tax_notice','deadline','bank_alert','taxdome_message','renewal','other')),
  title TEXT NOT NULL,
  source TEXT,
  amount_cents INT,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','actioned','dismissed','snoozed')),
  snooze_until DATE,
  notes TEXT,
  raw_email_id TEXT
);
CREATE INDEX fin_items_status_idx ON public.fin_items (status);
CREATE INDEX fin_items_due_date_idx ON public.fin_items (due_date ASC NULLS LAST);
CREATE INDEX fin_items_type_idx ON public.fin_items (type);
CREATE INDEX fin_items_created_idx ON public.fin_items (created_at DESC);

-- financial decisions log (same shape as cmo/pam/carl/opsy)
CREATE TABLE IF NOT EXISTS public.fin_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision TEXT NOT NULL,
  context TEXT,
  amount_cents INT,
  category TEXT,
  logged_by TEXT NOT NULL DEFAULT 'garrett'
);
CREATE INDEX fin_decisions_created_idx ON public.fin_decisions (created_at DESC);
CREATE INDEX fin_decisions_category_idx ON public.fin_decisions (category);

-- recurring expected items (subscriptions, tax deadlines, statement cycles)
CREATE TABLE IF NOT EXISTS public.fin_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  typical_amount_cents INT,
  typical_cycle TEXT NOT NULL CHECK (typical_cycle IN ('monthly','annual','quarterly','one-off')),
  last_seen DATE,
  next_expected DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fin_patterns_next_expected_idx ON public.fin_patterns (next_expected ASC NULLS LAST);
CREATE INDEX fin_patterns_vendor_idx ON public.fin_patterns (vendor);

-- QBO / Gusto / payroll snapshot cache
-- each row is one briefing snapshot type; upserted by fin_briefing
CREATE TABLE IF NOT EXISTS public.fin_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('p_and_l','balance_sheet','cash_flow','ap_aging','ar_aging','payroll','briefing')),
  data JSONB NOT NULL DEFAULT '{}',
  period_label TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fin_snapshots_type_fetched_idx ON public.fin_snapshots (snapshot_type, fetched_at DESC);
CREATE INDEX fin_snapshots_fetched_idx ON public.fin_snapshots (fetched_at DESC);

-- key-value working state (same pattern as opsy_memory / cmo_memory)
CREATE TABLE IF NOT EXISTS public.fin_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL
);

ALTER TABLE public.fin_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_memory ENABLE ROW LEVEL SECURITY;

-- seed recurring patterns from posture.md
INSERT INTO public.fin_patterns (vendor, description, typical_cycle, next_expected, notes) VALUES
  ('Slack',       'annual subscription renewal',              'annual',    '2026-06-18', 'next renewal ~june 18, 2026'),
  ('Vercel',      'monthly hosting — wv-site + apps',         'monthly',   NULL,          '~$20/mo'),
  ('Anthropic',   'monthly API usage',                        'monthly',   NULL,          'usage-based — check billing'),
  ('Cloudflare',  'annual plan + domain fees',                'annual',    NULL,          '~$5/yr — confirm next renewal date'),
  ('Notion',      'annual team plan',                         'annual',    NULL,          'confirm next renewal date'),
  ('Dropbox',     'annual storage plan',                      'annual',    NULL,          'confirm next renewal date'),
  ('ADP',         'monthly retirement plan recordkeeping fee','monthly',   NULL,          'until plan terminates june 30, 2026'),
  ('Chase Sapphire Reserve', 'monthly statement / minimum payment due', 'monthly', NULL, '~first week of month'),
  ('Straight Talk CPAs', 'monthly bookkeeping close',         'monthly',   NULL,          'Abhishek closes books ~mid following month'),
  ('IRS',         'Q3 federal estimated tax payment',         'quarterly', '2026-09-15',  'confirm amount with Sabir'),
  ('State',       'Q3 state estimated tax payment',           'quarterly', '2026-09-15',  'confirm amount with Sabir')
ON CONFLICT DO NOTHING;

-- seed working state
INSERT INTO public.fin_memory (key, value, updated_by) VALUES
  ('posture-version',   'docs/fin/posture.md, established 2026-06-12', 'garrett'),
  ('open-items-note',   'May 2026 financials unreviewed; 2025 1120-S in preparation at Straight Talk CPAs; ADP plan terminating June 30 (rollover + Roth conversion pending); Q2 Tax Amplifier organiser pending in TaxDome; Form 5500 submitted June 12', 'garrett'),
  ('adviser-contacts',  'Abhishek Sachdeva (bookkeeper, Straight Talk CPAs); Sabir (CPA/tax, Straight Talk CPAs)', 'garrett')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

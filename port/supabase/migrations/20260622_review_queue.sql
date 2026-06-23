-- Review queue for human-in-the-loop email automation (P2).
-- The outcome/payment scanners enqueue PROPOSED changes here; nothing mutates
-- deals or RFP status until a human approves an item at /inbox.
-- Apply in the Supabase SQL editor (port DB).

create table if not exists review_queue (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('rfp_outcome', 'payment')),
  -- target identifiers (notion_page_id): rfp_id for outcomes, deal_id for payments
  rfp_id          text,
  deal_id         text,
  -- proposed change, e.g. {"status":"lost"} or {"received_amount":96570}
  proposed        jsonb not null,
  -- human-readable summary shown on the /inbox card
  summary         text not null,
  -- source provenance + dedup
  source          text not null default 'email',
  source_email_id text,
  -- lifecycle
  status          text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     text
);

create index if not exists review_queue_status_idx on review_queue (status, created_at desc);

-- one queued item per (email, kind) so re-scans don't duplicate
create unique index if not exists review_queue_email_kind_uniq
  on review_queue (source_email_id, kind)
  where source_email_id is not null;

-- Enable RLS (default-deny; no policies). review_queue is read/written ONLY via
-- the service-role client (lib/supabase/client.ts -> SUPABASE_SECRET_KEY, which
-- bypasses RLS), so the /inbox page + scanners keep working while nothing public
-- can touch it. Applied manually on 2026-06-22 because this table was created
-- before the force_rls_on_new_tables trigger (20260622_enable_rls_port_usage_events)
-- was live — included here so the migration is reproducible.
alter table public.review_queue enable row level security;

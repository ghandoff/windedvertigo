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

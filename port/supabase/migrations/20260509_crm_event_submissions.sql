-- Phase 6: conference intelligence — multi-submission tracking.
--
-- A single conference can host several w.v contributions: 2 talks, 1 panel,
-- 1 sponsorship, etc. Each submission is a first-class row tied to one
-- crm_events row via event_id (notion_page_id).
--
-- Status enum mirrors the canonical drafting → submitted → accepted/rejected
-- flow; withdrawn is the explicit "we pulled out" terminal state.

create table if not exists crm_event_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references crm_events(notion_page_id) on delete cascade,
  kind text not null check (kind in ('talk', 'panel', 'workshop', 'sponsorship', 'booth', 'poster', 'other')),
  title text not null,
  abstract text,
  status text default 'drafting'
    check (status in ('drafting', 'submitted', 'accepted', 'rejected', 'withdrawn')),
  decision_at timestamptz,
  presenter_contact_ids text[] default '{}',
  submitted_by text,
  submitted_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists crm_event_submissions_event_id_idx on crm_event_submissions (event_id);
create index if not exists crm_event_submissions_status_idx on crm_event_submissions (status);
create index if not exists crm_event_submissions_kind_idx on crm_event_submissions (kind);

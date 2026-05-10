-- Phase 7: per-event contact tracking.
--
-- Captures the people the team wants to meet (target), met (met),
-- and followed up with (followed_up) at each conference / event.
-- Join table: event_id × contact_id × status.
--
-- The unique(event_id, contact_id) constraint prevents duplicate links
-- if someone clicks "+ add target" twice for the same person.

create table if not exists crm_event_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references crm_events(notion_page_id) on delete cascade,
  contact_id text not null,
  status text default 'target'
    check (status in ('target', 'met', 'followed_up', 'dropped')),
  notes text,
  met_at timestamptz,
  followed_up_at timestamptz,
  added_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, contact_id)
);

create index if not exists crm_event_contacts_event_id_idx
  on crm_event_contacts (event_id);
create index if not exists crm_event_contacts_contact_id_idx
  on crm_event_contacts (contact_id);
create index if not exists crm_event_contacts_status_idx
  on crm_event_contacts (status);

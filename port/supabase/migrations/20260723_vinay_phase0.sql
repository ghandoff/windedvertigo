-- vinay (garrett's personal-assistant agent) — phase 0 schema.
--
-- Apply via the Supabase SQL editor of the wv-vinay project (NOT wv-port-pilot).
-- A separate project = personal context never shares a database, backup, or dump
-- with company data. Same posture as every agent table: RLS enabled, no policies
-- — service-role-only access via port/lib/vinay/client.ts.

create table if not exists public.vinay_memory (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.vinay_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  decision text not null,
  context text,
  category text,
  logged_by text
);

create table if not exists public.vinay_commitments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  what text not null,
  due_date date,
  source text,
  status text not null default 'not-started'
    check (status in ('not-started','in-progress','blocked','done','parked')),
  channel text,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.vinay_journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  did text,   -- what got done this session
  open text,  -- what's still open
  next text,  -- the natural next step
  source text
);

create index if not exists vinay_commitments_status_due_idx
  on public.vinay_commitments (status, due_date);
create index if not exists vinay_journal_created_idx
  on public.vinay_journal (created_at desc);
create index if not exists vinay_decisions_created_idx
  on public.vinay_decisions (created_at desc);

alter table public.vinay_memory      enable row level security;
alter table public.vinay_decisions   enable row level security;
alter table public.vinay_commitments enable row level security;
alter table public.vinay_journal     enable row level security;

-- 0001_booking_init.sql
-- multi-host scheduling system schema
-- target: supabase postgres (project: wv-booking)
-- safe to re-run within the same migration set if needed (idempotent extensions only)

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ── hosts ─────────────────────────────────────────────────────────
-- one row per collective member who can host bookings
create table if not exists hosts (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  display_name       text not null,
  email              text not null,
  timezone           text not null default 'America/Los_Angeles',
  -- working_hours shape: {"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]],...}
  -- empty array means closed that day
  working_hours      jsonb not null default '{}'::jsonb,
  buffer_before_min  int not null default 0,
  buffer_after_min   int not null default 10,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ── oauth tokens ──────────────────────────────────────────────────
-- one row per host. refresh_token is encrypted at rest (AES-GCM via Web Crypto).
-- access_token is short-lived (5 min) and stored plaintext.
create table if not exists oauth_tokens (
  host_id              uuid primary key references hosts(id) on delete cascade,
  provider             text not null default 'google',
  refresh_token_ct     text not null,
  refresh_token_iv     text not null,
  access_token         text,
  access_expires_at    timestamptz,
  scope                text not null,
  google_account_email text not null,
  updated_at           timestamptz not null default now()
);

-- ── event types ───────────────────────────────────────────────────
-- bookable things. mode determines how host(s) are selected.
create table if not exists event_types (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  description     text,
  duration_min    int not null,
  mode            text not null check (mode in ('solo','collective','round_robin')),
  host_pool       uuid[] not null,
  min_required    int not null default 1,
  primary_host_id uuid references hosts(id),
  notice_min      int not null default 240,
  horizon_days    int not null default 30,
  slot_step_min   int not null default 30,
  active          boolean not null default true,
  intake_required boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── bookings ──────────────────────────────────────────────────────
-- core scheduling table. EXCLUDE constraint prevents double-booking the same host.
create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  event_type_id       uuid not null references event_types(id),
  assigned_host_id    uuid not null references hosts(id),
  collective_host_ids uuid[] not null default '{}',
  during              tstzrange not null,
  visitor_name        text not null,
  visitor_email       text not null,
  visitor_tz          text not null,
  intake              jsonb,
  google_event_id     text,
  meet_url            text,
  status              text not null default 'confirmed'
                          check (status in ('confirmed','cancelled','rescheduled')),
  created_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  exclude using gist (assigned_host_id with =, during with &&)
    where (status = 'confirmed')
);

create index if not exists bookings_during_idx on bookings using gist (during);
create index if not exists bookings_host_idx on bookings (assigned_host_id) where status='confirmed';
create index if not exists bookings_event_type_idx on bookings (event_type_id, created_at desc);
create index if not exists bookings_email_idx on bookings (visitor_email);

-- ── availability overrides ────────────────────────────────────────
-- per-host one-off unavailability or extra availability
create table if not exists availability_overrides (
  id        uuid primary key default gen_random_uuid(),
  host_id   uuid not null references hosts(id) on delete cascade,
  during    tstzrange not null,
  kind      text not null check (kind in ('block','extra')),
  reason    text
);
create index if not exists avail_overrides_host_idx
  on availability_overrides using gist (host_id, during);

-- ── audit log ─────────────────────────────────────────────────────
create table if not exists booking_audit (
  id          bigserial primary key,
  booking_id  uuid references bookings(id) on delete cascade,
  action      text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- ── round-robin fairness view ─────────────────────────────────────
-- queryable summary of recent assignments per host. used as ORDER BY in book_round_robin.
create or replace view host_assignments_30d as
  select assigned_host_id,
         count(*)::int as n,
         max(created_at) as last_assigned_at
    from bookings
   where created_at > now() - interval '30 days'
     and status = 'confirmed'
  group by assigned_host_id;

-- ── round-robin booking function ──────────────────────────────────
-- atomic selection + insert. retries across pool on exclusion_violation.
-- raises 'no_available_host' if nobody in the pool can take the slot.
create or replace function book_round_robin(
  p_event_type_id uuid,
  p_during        tstzrange,
  p_visitor       jsonb,
  p_intake        jsonb
) returns bookings as $$
declare
  v_pool    uuid[];
  v_host_id uuid;
  v_booking bookings;
begin
  select host_pool into v_pool from event_types where id = p_event_type_id;

  for v_host_id in
    select h.id
      from unnest(v_pool) as h(id)
      left join host_assignments_30d ha on ha.assigned_host_id = h.id
      where not exists (
        select 1 from bookings b
         where b.assigned_host_id = h.id
           and b.status = 'confirmed'
           and b.during && p_during
      )
      order by coalesce(ha.n, 0) asc,
               coalesce(ha.last_assigned_at, '1970-01-01'::timestamptz) asc
  loop
    begin
      insert into bookings (
        event_type_id, assigned_host_id, during,
        visitor_name, visitor_email, visitor_tz, intake
      ) values (
        p_event_type_id, v_host_id, p_during,
        p_visitor->>'name', p_visitor->>'email', p_visitor->>'tz', p_intake
      ) returning * into v_booking;
      return v_booking;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  raise exception 'no_available_host';
end;
$$ language plpgsql;

-- ── row-level security ────────────────────────────────────────────
-- all tables RLS-enabled with NO public policies.
-- service-role key bypasses RLS — that's how server routes access data.
-- visitors never get a Supabase client.
alter table hosts                  enable row level security;
alter table oauth_tokens           enable row level security;
alter table event_types            enable row level security;
alter table bookings               enable row level security;
alter table availability_overrides enable row level security;
alter table booking_audit          enable row level security;

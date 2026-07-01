-- 0004_polls.sql
-- group availability polls (discrete-slot, Doodle-style)
-- target: supabase postgres (project: wv-booking, ref: phvmhjtfxyvhjfjnlalg)
--
-- host creates a poll from /bookings/polls/new → shareable /book/poll/[slug]
-- anonymous respondents mark yes / if_need_be / no per slot
-- host locks winning slot from port UI → optionally creates a booking

-- ── polls ─────────────────────────────────────────────────────────

create table polls (
  id                 uuid        primary key default gen_random_uuid(),
  slug               text        unique not null,
  edit_token         text        not null,
  title              text        not null,
  description        text,
  created_by_host_id uuid        references hosts(id) on delete set null,
  locked_option_id   uuid,       -- filled when host converges; fk added below
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── poll_options ──────────────────────────────────────────────────
-- discrete candidate slots the host proposes

create table poll_options (
  id         uuid        primary key default gen_random_uuid(),
  poll_id    uuid        not null references polls(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  sort_order int         not null default 0
);

-- add fk now that poll_options exists
alter table polls
  add constraint polls_locked_option_id_fk
  foreign key (locked_option_id) references poll_options(id) on delete set null;

-- ── poll_responses ────────────────────────────────────────────────
-- one row per respondent (anonymous — name only, no account needed)

create table poll_responses (
  id              uuid        primary key default gen_random_uuid(),
  poll_id         uuid        not null references polls(id) on delete cascade,
  respondent_name text        not null,
  created_at      timestamptz not null default now()
);

-- ── poll_response_choices ─────────────────────────────────────────
-- one row per (respondent × slot) with their availability verdict

create table poll_response_choices (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid not null references poll_responses(id) on delete cascade,
  option_id    uuid not null references poll_options(id)   on delete cascade,
  availability text not null check (availability in ('yes', 'if_need_be', 'no')),
  unique (response_id, option_id)
);

-- ── rls ───────────────────────────────────────────────────────────

alter table polls                enable row level security;
alter table poll_options         enable row level security;
alter table poll_responses       enable row level security;
alter table poll_response_choices enable row level security;

-- anon can read everything (the respond page is public — names shown to all
-- respondents who share the same link, same consent model as Doodle/When2meet)
create policy "polls_anon_read"
  on polls for select using (true);

create policy "poll_options_anon_read"
  on poll_options for select using (true);

create policy "poll_responses_anon_read"
  on poll_responses for select using (true);

create policy "poll_response_choices_anon_read"
  on poll_response_choices for select using (true);

-- anon can insert responses + choices (respondent submits without logging in)
create policy "poll_responses_anon_insert"
  on poll_responses for insert with check (true);

create policy "poll_response_choices_anon_insert"
  on poll_response_choices for insert with check (true);

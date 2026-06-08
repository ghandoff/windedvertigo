-- the weave workshop tables
-- used by site/public/tools/the-weave/index.html

create table weave_sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  title text not null default 'the weave',
  active_phase integer not null default 0,
  phase_revealed boolean not null default false,
  created_at timestamptz not null default now(),
  facilitator_name text,
  config jsonb default '{}'::jsonb
);

create table weave_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references weave_sessions(id) on delete cascade,
  name text not null,
  role text,
  org text,
  joined_at timestamptz not null default now(),
  unique(session_id, name)
);

create table weave_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references weave_sessions(id) on delete cascade,
  participant_id uuid references weave_participants(id) on delete cascade,
  phase integer not null,
  response_type text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- enable real-time
alter publication supabase_realtime add table weave_sessions;
alter publication supabase_realtime add table weave_participants;
alter publication supabase_realtime add table weave_responses;

-- RLS (anon key access for the workshop tool)
alter table weave_sessions enable row level security;
alter table weave_participants enable row level security;
alter table weave_responses enable row level security;

create policy "anyone can read sessions" on weave_sessions for select using (true);
create policy "anyone can create sessions" on weave_sessions for insert with check (true);
create policy "anyone can update sessions" on weave_sessions for update using (true);

create policy "anyone can read participants" on weave_participants for select using (true);
create policy "anyone can join" on weave_participants for insert with check (true);

create policy "anyone can read responses" on weave_responses for select using (true);
create policy "anyone can respond" on weave_responses for insert with check (true);
create policy "anyone can update responses" on weave_responses for update using (true);

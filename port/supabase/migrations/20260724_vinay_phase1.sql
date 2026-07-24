-- vinay phase 1 — perception (read-only). Apply in the wv-vinay project SQL editor.
-- Same posture as phase 0: RLS enabled, no policies (service-role-only via lib/vinay/client.ts).

-- perceived items from garrett's streams (idempotent on source+external_id)
create table if not exists public.vinay_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,        -- work-cal | work-gmail | pam-commitment | intervention | escalation | personal-gmail:<label> | personal-cal:<label>
  external_id text not null,   -- source-native id, for dedup
  kind text,                   -- meeting | email | commitment | escalation | ...
  title text,
  body text,
  event_time timestamptz,      -- when the thing happens/happened (event time, not perceived time)
  payload jsonb,
  perceived_at timestamptz not null default now(),
  unique (source, external_id)
);

-- the daily anticipation brief
create table if not exists public.vinay_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null,
  body text,                   -- markdown
  items jsonb,                 -- structured items, each with a stable key for grading
  event_count int,
  model_id text,
  created_at timestamptz not null default now()
);

-- garrett's grades on a brief (or a specific item) — seed signal for the future learning loop
create table if not exists public.vinay_brief_grades (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.vinay_briefs(id) on delete cascade,
  item_key text,               -- null = grading the whole brief
  grade text not null check (grade in ('useful','not-useful','wrong')),
  note text,
  created_at timestamptz not null default now()
);

-- fail-loud heartbeat — every sweep records here, ok OR error, so a silent no-op is visible
create table if not exists public.vinay_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,          -- anticipation
  status text not null check (status in ('ok','error')),
  detail text,
  ran_at timestamptz not null default now()
);

create index if not exists vinay_events_time_idx on public.vinay_events (event_time desc);
create index if not exists vinay_events_perceived_idx on public.vinay_events (perceived_at desc);
create index if not exists vinay_briefs_date_idx on public.vinay_briefs (brief_date desc);
create index if not exists vinay_runs_ran_idx on public.vinay_runs (ran_at desc);

alter table public.vinay_events       enable row level security;
alter table public.vinay_briefs       enable row level security;
alter table public.vinay_brief_grades enable row level security;
alter table public.vinay_runs         enable row level security;

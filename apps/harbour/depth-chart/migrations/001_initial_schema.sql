-- depth.chart initial schema
-- run against a dedicated Neon project (separate from creaseworks)

-- ── users ────────────────────────────────────────────────────────────
create table if not exists users (
  id              text primary key default gen_random_uuid()::text,
  email           text unique not null,
  name            text,
  email_verified  boolean default false,
  institution     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── OAuth account links (for Google sign-in) ─────────────────────────
create table if not exists accounts (
  id                    text primary key default gen_random_uuid()::text,
  user_id               text not null references users(id) on delete cascade,
  provider              text not null,
  provider_account_id   text not null,
  type                  text not null,
  created_at            timestamptz default now(),
  unique (provider, provider_account_id)
);

-- ── magic-link verification tokens ───────────────────────────────────
create table if not exists verification_token (
  identifier  text not null,
  token       text not null,
  expires     timestamptz not null,
  primary key (identifier, token)
);

-- ── lesson plans ─────────────────────────────────────────────────────
create table if not exists plans (
  id              text primary key default gen_random_uuid()::text,
  user_id         text references users(id) on delete cascade,
  title           text,
  subject         text,
  grade_level     text,
  raw_text        text not null,
  source_format   text default 'text',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── learning objectives ──────────────────────────────────────────────
create table if not exists objectives (
  id                  text primary key default gen_random_uuid()::text,
  plan_id             text not null references plans(id) on delete cascade,
  raw_text            text not null,
  cognitive_verb      text,
  blooms_level        text not null,
  knowledge_dimension text,
  content_topic       text,
  context             text,
  confidence          real,
  sort_order          int default 0
);

-- ── generated tasks ──────────────────────────────────────────────────
create table if not exists tasks (
  id                  text primary key default gen_random_uuid()::text,
  objective_id        text not null references objectives(id) on delete cascade,
  blooms_level        text not null,
  task_format         text not null,
  prompt_text         text not null,
  time_estimate_min   int,
  collaboration_mode  text,
  rubric_json         jsonb,
  ej_scaffold_json    jsonb,
  authenticity_json   jsonb,
  reliability_notes   text[],
  generation_attempts int default 1,
  authenticity_passed boolean default true,
  created_at          timestamptz default now()
);

-- ── feedback (post-generation task rating) ───────────────────────────
create table if not exists feedback (
  id          text primary key default gen_random_uuid()::text,
  user_id     text references users(id) on delete set null,
  task_id     text references tasks(id) on delete cascade,
  plan_id     text references plans(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now()
);

-- ── usage telemetry ──────────────────────────────────────────────────
create table if not exists usage_events (
  id          text primary key default gen_random_uuid()::text,
  user_id     text references users(id) on delete set null,
  event_type  text not null,
  metadata    jsonb,
  created_at  timestamptz default now()
);

-- ── indexes ──────────────────────────────────────────────────────────
create index if not exists idx_accounts_user on accounts(user_id);
create index if not exists idx_plans_user on plans(user_id);
create index if not exists idx_plans_created on plans(created_at desc);
create index if not exists idx_objectives_plan on objectives(plan_id);
create index if not exists idx_tasks_objective on tasks(objective_id);
create index if not exists idx_feedback_plan on feedback(plan_id);
create index if not exists idx_feedback_user on feedback(user_id);
create index if not exists idx_usage_user on usage_events(user_id, event_type);
create index if not exists idx_usage_created on usage_events(created_at desc);

-- AI usage logging — replaces /tmp-based store (Vercel-only).
-- CF Workers have no filesystem, so all token usage records were evaporating
-- on every request. This table provides durable per-call storage.

create table if not exists ai_usage_logs (
  id          uuid primary key default gen_random_uuid(),
  timestamp   timestamptz not null default now(),
  feature     text not null,
  model       text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cost_usd    numeric(12, 8) not null default 0,
  user_id     text,
  duration_ms int,
  metadata    jsonb
);

create index if not exists ai_usage_logs_timestamp_idx on ai_usage_logs (timestamp desc);
create index if not exists ai_usage_logs_feature_idx   on ai_usage_logs (feature);
create index if not exists ai_usage_logs_user_id_idx   on ai_usage_logs (user_id);

-- Budget config — single-row table (upsert on id = 1).
create table if not exists ai_budget_config (
  id                    int primary key default 1,
  monthly_limit_usd     numeric(10, 2) not null default 50.00,
  warning_threshold_pct int not null default 80,
  updated_at            timestamptz default now()
);

-- Seed the default budget row so reads never return empty.
insert into ai_budget_config (id, monthly_limit_usd, warning_threshold_pct)
values (1, 50.00, 80)
on conflict (id) do nothing;

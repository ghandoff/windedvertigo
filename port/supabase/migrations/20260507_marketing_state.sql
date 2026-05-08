-- marketing_state: singleton key-value store for cached marketing data.
-- Currently used for the social-stats snapshot displayed on /strategy.
-- Conceptual KV mapping: key = 'social-stats' ↔ KV key 'marketing:social-stats'.

create table if not exists marketing_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

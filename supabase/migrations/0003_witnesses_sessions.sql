create table witnesses_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days',
  recipient_name text,
  seed_phrase text,
  seed_name text,
  visit_order text[],
  visits jsonb default '[]',
  image_seed bigint,
  seed_image_url text,
  round int default 1,
  paired_session_id uuid references witnesses_sessions(id)
);

-- Index for expiry cleanup
create index witnesses_sessions_expires_at_idx on witnesses_sessions (expires_at);

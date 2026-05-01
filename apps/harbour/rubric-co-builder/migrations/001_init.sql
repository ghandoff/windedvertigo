create schema if not exists rubric_cobuilder;

create table if not exists rubric_cobuilder.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  learning_outcome text not null,
  project_description text not null,
  state text not null default 'lobby',
  step_started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on rubric_cobuilder.rooms (code);

create table if not exists rubric_cobuilder.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rubric_cobuilder.rooms(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create index if not exists participants_room_idx on rubric_cobuilder.participants (room_id);

create table if not exists rubric_cobuilder.criteria (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rubric_cobuilder.rooms(id) on delete cascade,
  name text not null,
  good_description text,
  failure_description text,
  source text not null default 'proposed',
  required boolean not null default false,
  status text not null default 'proposed',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists criteria_room_idx on rubric_cobuilder.criteria (room_id);

create table if not exists rubric_cobuilder.votes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  criterion_id uuid not null references rubric_cobuilder.criteria(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_id, criterion_id)
);

create index if not exists votes_criterion_idx on rubric_cobuilder.votes (criterion_id);

create table if not exists rubric_cobuilder.scales (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references rubric_cobuilder.criteria(id) on delete cascade,
  level int not null check (level between 1 and 4),
  descriptor text not null,
  updated_at timestamptz not null default now(),
  unique (criterion_id, level)
);

create table if not exists rubric_cobuilder.scale_editors (
  id uuid primary key default gen_random_uuid(),
  scale_id uuid not null references rubric_cobuilder.scales(id) on delete cascade,
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  unique (scale_id, participant_id)
);

create table if not exists rubric_cobuilder.calibration_scores (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  criterion_id uuid not null references rubric_cobuilder.criteria(id) on delete cascade,
  level int not null check (level between 1 and 4),
  created_at timestamptz not null default now(),
  unique (participant_id, criterion_id)
);

-- adds the AI-use contract step: ladder vote + integrity pledge.

create table if not exists rubric_cobuilder.ai_use_votes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  room_id uuid not null references rubric_cobuilder.rooms(id) on delete cascade,
  level int not null check (level between 0 and 4),
  created_at timestamptz not null default now(),
  unique (participant_id, room_id)
);

create index if not exists ai_use_votes_room_idx on rubric_cobuilder.ai_use_votes (room_id);

create table if not exists rubric_cobuilder.pledge_slots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rubric_cobuilder.rooms(id) on delete cascade,
  slot_index int not null check (slot_index between 1 and 4),
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (room_id, slot_index)
);

-- per-student pledge entries and votes (mirrors scale_responses / scale_response_votes)

create table rubric_cobuilder.pledge_responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  room_id uuid not null references rubric_cobuilder.rooms(id) on delete cascade,
  slot_index int not null check (slot_index between 1 and 4),
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (participant_id, room_id, slot_index)
);

create table rubric_cobuilder.pledge_response_votes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  pledge_response_id uuid not null references rubric_cobuilder.pledge_responses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_id, pledge_response_id)
);

-- round 2 now votes on per-student scale_responses rather than re-voting on criteria.
-- each dot targets a specific scale_response row.
create table if not exists rubric_cobuilder.scale_response_votes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  scale_response_id uuid not null references rubric_cobuilder.scale_responses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_id, scale_response_id)
);

create index if not exists scale_response_votes_response_idx
  on rubric_cobuilder.scale_response_votes (scale_response_id);

-- ai_ladder is now a propose→vote split. each participant posts one proposal
-- (a level + rationale) during ai_ladder_propose, then everyone votes on proposals
-- during ai_ladder.
create table if not exists rubric_cobuilder.ai_use_proposals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rubric_cobuilder.rooms(id) on delete cascade,
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  level int not null check (level between 0 and 4),
  rationale text not null default '',
  created_at timestamptz not null default now(),
  unique (room_id, participant_id)
);

create index if not exists ai_use_proposals_room_idx
  on rubric_cobuilder.ai_use_proposals (room_id);

create table if not exists rubric_cobuilder.ai_use_proposal_votes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  proposal_id uuid not null references rubric_cobuilder.ai_use_proposals(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_id, proposal_id)
);

create index if not exists ai_use_proposal_votes_proposal_idx
  on rubric_cobuilder.ai_use_proposal_votes (proposal_id);

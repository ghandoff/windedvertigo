-- three voting rounds: add round column to votes, update unique constraint
alter table rubric_cobuilder.votes
  add column if not exists round int not null default 1 check (round between 1 and 3);

-- drop the old unique constraint (participant, criterion) and replace with one that
-- includes round so the same participant can vote on the same criterion across rounds.
alter table rubric_cobuilder.votes
  drop constraint if exists votes_participant_id_criterion_id_key;

create unique index if not exists votes_participant_criterion_round_key
  on rubric_cobuilder.votes (participant_id, criterion_id, round);

-- criterion versioning: when a student edits a proposed criterion we create a new
-- row rather than overwriting. version_of points to the original criterion.
alter table rubric_cobuilder.criteria
  add column if not exists version_of uuid references rubric_cobuilder.criteria(id) on delete set null;

-- per-student scale responses shown side-by-side in the scale step.
-- the existing rubric_cobuilder.scales table holds the canonical descriptor used
-- in the final rubric; scale_responses stores each participant's individual input.
create table if not exists rubric_cobuilder.scale_responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references rubric_cobuilder.participants(id) on delete cascade,
  criterion_id uuid not null references rubric_cobuilder.criteria(id) on delete cascade,
  level int not null check (level between 1 and 4),
  descriptor text not null default '',
  updated_at timestamptz not null default now(),
  unique (participant_id, criterion_id, level)
);

create index if not exists scale_responses_criterion_idx
  on rubric_cobuilder.scale_responses (criterion_id);

alter table rubric_cobuilder.rooms
  add column if not exists host_token uuid not null default gen_random_uuid();

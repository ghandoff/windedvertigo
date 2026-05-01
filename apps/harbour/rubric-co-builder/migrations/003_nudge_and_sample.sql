-- adds facilitator_nudge (a room-wide clarifying question pinned by the host)
-- and sample_artefact_{title,content} (optionally AI-generated per room).

alter table rubric_cobuilder.rooms
  add column if not exists facilitator_nudge text,
  add column if not exists sample_artefact_title text,
  add column if not exists sample_artefact_content text;

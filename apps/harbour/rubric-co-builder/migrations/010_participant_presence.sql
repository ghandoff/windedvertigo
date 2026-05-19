-- Adds a last-seen timestamp to participants so the facilitator can tell
-- who's actively present vs idle. Used by the heartbeat endpoint
-- (POST /api/rooms/[code]/heartbeat) and surfaced in getSnapshot as a
-- presence summary {active, idle}.
--
-- Defaults to NOW() so existing rows are treated as just-seen on first
-- read. Subsequent reads use the actual heartbeat timestamps.

alter table rubric_cobuilder.participants
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists participants_last_seen_idx
  on rubric_cobuilder.participants (room_id, last_seen_at);

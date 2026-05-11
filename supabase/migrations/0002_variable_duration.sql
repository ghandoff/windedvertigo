-- 0002_variable_duration.sql
-- Variable-duration bookings: visitors can pick from a list of allowed durations
-- (e.g., 30/60/90 min) instead of being locked to event_type.duration_min.
--
-- Empty array = single-duration (current behavior; falls back to duration_min).
-- Non-empty   = visitor sees a duration toggle and picks. The chosen value
--               must be a member of duration_options (validated server-side).

alter table event_types
  add column if not exists duration_options int[] not null default '{}'::int[];

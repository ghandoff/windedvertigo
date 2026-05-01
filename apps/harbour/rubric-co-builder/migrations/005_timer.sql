-- facilitator-controlled step timers
alter table rubric_cobuilder.rooms
  add column if not exists timer_end timestamptz,
  add column if not exists timer_duration int;  -- seconds; null = no active timer

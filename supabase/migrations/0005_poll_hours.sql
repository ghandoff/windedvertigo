-- 0005_poll_hours.sql
-- Per-host scheduling window for group polls, separate from working_hours.
--
-- Polls often span timezones (e.g. international invitees), so a host may want a
-- wider availability window when proposing poll slots than for regular 1:1
-- bookings — e.g. 07:00–14:00 PT for polls vs 09:00–17:00 PT for bookings.
--
-- Same shape as working_hours: {"mon":[["07:00","14:00"]],"tue":[...],...}
-- NULL = no poll-specific window; collective-slots falls back to working_hours
-- (see lib/booking/collective-slots.ts: `poll_hours ?? working_hours`).
--
-- NOTE: this column was originally applied by hand to the prod DB
-- (phvmhjtfxyvhjfjnlalg) on 2026-07-02; this migration backfills it into
-- version control. `if not exists` makes it a no-op where it already exists.

alter table hosts
  add column if not exists poll_hours jsonb;

-- PaM commitments: add an optional start_date so commitments can render as
-- Gantt bars (start_date → due_date). When start_date is null, the commitment
-- renders as a milestone diamond at its due_date until a start is set.

ALTER TABLE pam_commitments ADD COLUMN IF NOT EXISTS start_date date;

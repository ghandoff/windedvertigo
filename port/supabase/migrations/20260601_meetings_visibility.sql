-- Per-meeting visibility — privacy for non-WV meetings.
--
-- When each team member's Drive gets scanned for Meet AI transcripts, some
-- of those meetings will be personal/private (1:1s with non-WV people, family
-- calls, therapy, etc.). Members need a way to ingest a meeting into their
-- OWN Council view without exposing it to the whole team.
--
-- visibility:
--   'shared'  — default; visible team-wide in /council
--   'private' — visible ONLY to owner_email's user in /council
--
-- owner_email: the team member responsible for the meeting. For Meet AI
-- ingest, this is the impersonated subject whose Drive the transcript came
-- from. For /transcribe captures, this is the authenticated user. For
-- gcal-sync pre-creates, set to the organizer's email if a WV member,
-- otherwise the first WV-domain attendee.
--
-- Default is 'shared' to preserve existing data semantics (everything we
-- ingested before this migration is team-visible).

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS visibility TEXT
  NOT NULL DEFAULT 'shared'
  CHECK (visibility IN ('shared', 'private'));

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS owner_email TEXT;

CREATE INDEX IF NOT EXISTS meetings_visibility_owner_idx
  ON meetings (visibility, owner_email);

COMMENT ON COLUMN meetings.visibility IS 'shared = team-visible (default); private = only owner_email sees it in /council.';
COMMENT ON COLUMN meetings.owner_email IS 'Team member who ingested or owns this meeting record. Required to honor visibility=private. NULL allowed for shared meetings ingested before this migration.';

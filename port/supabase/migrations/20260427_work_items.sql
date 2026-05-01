CREATE TABLE IF NOT EXISTS work_items (
  notion_page_id  TEXT PRIMARY KEY,
  task            TEXT NOT NULL DEFAULT '',
  status          TEXT,
  task_type       TEXT,
  priority        TEXT,
  owner_ids       TEXT[] DEFAULT '{}',
  person_ids      TEXT[] DEFAULT '{}',
  project_ids     TEXT[] DEFAULT '{}',
  milestone_ids   TEXT[] DEFAULT '{}',
  parent_task_ids TEXT[] DEFAULT '{}',
  sub_task_ids    TEXT[] DEFAULT '{}',
  blocking_ids    TEXT[] DEFAULT '{}',
  blocked_by_ids  TEXT[] DEFAULT '{}',
  timesheet_ids   TEXT[] DEFAULT '{}',
  meeting_ids     TEXT[] DEFAULT '{}',
  due_date        TEXT,
  estimate_hours  NUMERIC,
  archive         BOOLEAN DEFAULT false,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_items_status_idx     ON work_items (status);
CREATE INDEX IF NOT EXISTS work_items_archive_idx    ON work_items (archive);
CREATE INDEX IF NOT EXISTS work_items_owner_ids_idx  ON work_items USING GIN (owner_ids);
CREATE INDEX IF NOT EXISTS work_items_project_ids_idx ON work_items USING GIN (project_ids);

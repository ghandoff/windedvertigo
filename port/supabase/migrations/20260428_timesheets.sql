CREATE TABLE IF NOT EXISTS timesheets (
  notion_page_id  TEXT PRIMARY KEY,
  entry           TEXT NOT NULL DEFAULT '',
  person_ids      TEXT[] DEFAULT '{}',
  date_start      TEXT,
  date_end        TEXT,
  hours           NUMERIC,
  minutes         NUMERIC,
  status          TEXT,
  type            TEXT,
  task_ids        TEXT[] DEFAULT '{}',
  meeting_ids     TEXT[] DEFAULT '{}',
  billable        BOOLEAN DEFAULT false,
  rate            NUMERIC,
  amount          NUMERIC,
  explanation     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timesheets_status_idx     ON timesheets (status);
CREATE INDEX IF NOT EXISTS timesheets_billable_idx   ON timesheets (billable);
CREATE INDEX IF NOT EXISTS timesheets_date_start_idx ON timesheets (date_start);
CREATE INDEX IF NOT EXISTS timesheets_person_ids_idx ON timesheets USING GIN (person_ids);

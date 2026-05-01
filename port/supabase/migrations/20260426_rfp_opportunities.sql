CREATE TABLE IF NOT EXISTS rfp_opportunities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        text UNIQUE NOT NULL,
  opportunity_name      text NOT NULL,
  status                text,
  opportunity_type      text,
  organization_ids      text[],
  estimated_value       numeric,
  due_date              date,
  wv_fit_score          text,
  service_match         text,
  category              text,
  geography             text,
  proposal_status       text,
  requirements_snapshot text,
  decision_notes        text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rfp_opportunities_notion_page_id_idx ON rfp_opportunities (notion_page_id);
CREATE INDEX IF NOT EXISTS rfp_opportunities_status_idx ON rfp_opportunities (status);

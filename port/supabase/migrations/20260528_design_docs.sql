-- Designed-docs surface for port (W2).
--
-- Markdown source + template choice produces a branded React-PDF artifact.
-- Lets us bypass the GDocs manual-paste friction for designed outputs
-- (proposals, reports) without giving up AI-collaborative drafting:
-- wv-claw / Cowork can edit the markdown surgically because we control
-- the data model, and the render step applies brand styling consistently.

CREATE TABLE IF NOT EXISTS design_docs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  -- Template key — matches a React-PDF component in lib/design-renderer/templates/.
  -- 'proposal-v1' is the only template at launch; add more as patterns emerge.
  template        TEXT NOT NULL DEFAULT 'proposal-v1',
  -- Frontmatter is structured metadata the template reads (client name,
  -- proposal date, version, etc). Schema is template-specific.
  frontmatter     JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_markdown TEXT NOT NULL DEFAULT '',
  owner_email     TEXT
);

CREATE INDEX IF NOT EXISTS design_docs_owner_idx
  ON design_docs (owner_email, updated_at DESC);

CREATE INDEX IF NOT EXISTS design_docs_updated_idx
  ON design_docs (updated_at DESC);

COMMENT ON TABLE design_docs IS 'Markdown sources for designed PDF outputs (W2). Bypasses GDocs friction for branded artifacts.';
COMMENT ON COLUMN design_docs.template IS 'Key into lib/design-renderer/templates/. Determines layout + styling.';
COMMENT ON COLUMN design_docs.frontmatter IS 'Template-specific structured metadata (client name, dates, version, etc).';

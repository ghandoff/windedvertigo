-- RFP Pipeline v2 Phase 2 — Markdown bundle tracking on rfp_opportunities
--
-- Each successful proposal generation now writes a Markdown bundle to
-- ghandoff/wv-proposals as a PR. We pin the PR URL + number to the RFP row
-- so the detail page, Slack DM, and downstream skills can find it without
-- a roundtrip to the GitHub API.
--
-- Both columns are nullable: pre-Phase-2 RFPs have no bundle, and the
-- queue consumer treats the write as best-effort (Notion sub-pages remain
-- the safety net).

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS markdown_bundle_url TEXT,
  ADD COLUMN IF NOT EXISTS markdown_bundle_pr_number INTEGER;

COMMENT ON COLUMN rfp_opportunities.markdown_bundle_url IS
  'PR URL on ghandoff/wv-proposals containing the canonical Markdown bundle. NULL for pre-Phase-2 RFPs.';
COMMENT ON COLUMN rfp_opportunities.markdown_bundle_pr_number IS
  'PR number on ghandoff/wv-proposals. Useful for re-opening or referencing without parsing the URL.';

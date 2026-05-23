-- Migration 012: pcs_comments
-- Part of the Tier-1 Notion migration. pcs_comments stores discussion
-- threads attached to any PCS entity (claim, document, evidence, etc.).
--
-- Originally these were Notion's native page-level comments
-- (notion.comments.list / .create). Notion comments don't live in a
-- database — they're a separate object type — so there's nothing to
-- backfill from the old surface. New comments will accrue here only.
--
-- Threading model:
--   - Top-level comment: discussion_id == own id; parent_comment_id NULL
--   - Reply:             discussion_id == thread's discussion_id;
--                        parent_comment_id == replied-to comment.id

CREATE TABLE IF NOT EXISTS pcs_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which PCS entity is being commented on (notion_page_id of a claim,
  -- document, evidence row, etc. — same ID format used everywhere else).
  parent_page_id    TEXT NOT NULL,
  -- Author. Matches reviewers.notion_page_id.
  created_by        TEXT NOT NULL,
  -- Content.
  text              TEXT NOT NULL,
  rich_text         JSONB,
  -- Threading.
  discussion_id     TEXT NOT NULL,
  parent_comment_id UUID REFERENCES pcs_comments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcs_comments_parent_page
  ON pcs_comments(parent_page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcs_comments_discussion
  ON pcs_comments(discussion_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pcs_comments_author
  ON pcs_comments(created_by);

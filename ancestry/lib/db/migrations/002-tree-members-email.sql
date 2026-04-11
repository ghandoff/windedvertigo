-- migration 002: tree members with email-based access
-- the original schema referenced user_id but we use email-based auth
-- this creates a proper tree_members table keyed on email

CREATE TABLE IF NOT EXISTS tree_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id       UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    member_email  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tree_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_tree_members_tree ON tree_members(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_members_email ON tree_members(member_email);

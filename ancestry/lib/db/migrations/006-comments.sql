CREATE TABLE comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id     UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    author_email TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('person', 'event', 'source', 'relationship')),
    target_id   UUID NOT NULL,
    parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_tree ON comments(tree_id);

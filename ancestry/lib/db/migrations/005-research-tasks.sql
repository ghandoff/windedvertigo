CREATE TABLE research_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id     UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    person_id   UUID REFERENCES persons(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'dismissed')),
    priority    TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    source      TEXT,  -- e.g. 'auto_hint', 'manual', 'auto_gap'
    hint_id     UUID REFERENCES hints(id) ON DELETE SET NULL,
    due_date    DATE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_research_tasks_tree ON research_tasks(tree_id);
CREATE INDEX idx_research_tasks_person ON research_tasks(person_id);
CREATE INDEX idx_research_tasks_status ON research_tasks(status);

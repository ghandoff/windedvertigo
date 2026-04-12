-- persisted layout positions for the pedigree/chart canvas
-- stores { [nodeId]: { x: number, y: number } } as JSONB on each tree
ALTER TABLE trees ADD COLUMN IF NOT EXISTS layout_positions JSONB DEFAULT '{}';

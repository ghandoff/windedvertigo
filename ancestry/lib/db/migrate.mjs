import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  `CREATE TABLE IF NOT EXISTS trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_email TEXT NOT NULL,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'authenticated', 'private')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    sex TEXT CHECK (sex IN ('M', 'F', 'X', 'U')),
    is_living BOOLEAN DEFAULT true,
    privacy_level TEXT DEFAULT 'private' CHECK (privacy_level IN ('public', 'authenticated', 'family', 'private')),
    thumbnail_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_persons_tree ON persons(tree_id)`,

  `CREATE TABLE IF NOT EXISTS person_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    name_type TEXT DEFAULT 'birth' CHECK (name_type IN ('birth', 'married', 'adopted', 'alias', 'nickname', 'other')),
    given_names TEXT,
    surname TEXT,
    prefix TEXT,
    suffix TEXT,
    display TEXT,
    is_primary BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_person_names_person ON person_names(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_person_names_search ON person_names(LOWER(surname), LOWER(given_names))`,

  `CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    person1_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    person2_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
      'biological_parent', 'adoptive_parent', 'foster_parent',
      'step_parent', 'guardian', 'godparent',
      'spouse', 'partner', 'ex_spouse', 'other'
    )),
    start_date JSONB,
    end_date JSONB,
    confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (person1_id, person2_id, relationship_type)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_relationships_tree ON relationships(tree_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relationships_person1 ON relationships(person1_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relationships_person2 ON relationships(person2_id)`,

  `CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES places(id),
    place_type TEXT CHECK (place_type IN ('country', 'state', 'county', 'city', 'address', 'cemetery', 'church', 'other')),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS place_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date_from DATE,
    date_to DATE,
    is_current BOOLEAN DEFAULT true
  )`,

  `CREATE INDEX IF NOT EXISTS idx_place_names_place ON place_names(place_id)`,

  `CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    date JSONB,
    sort_date DATE,
    place_id UUID REFERENCES places(id),
    description TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_events_sort ON events(sort_date)`,

  `CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    source_type TEXT,
    url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    page TEXT,
    confidence TEXT CHECK (confidence IN ('primary', 'secondary', 'questionable', 'unreliable')),
    extract TEXT,
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT,
    title TEXT,
    description TEXT,
    date JSONB,
    uploaded_at TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS media_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0
  )`,
];

async function migrate() {
  for (const stmt of statements) {
    try {
      await sql(stmt);
      const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
      console.log(`✓ ${preview}`);
    } catch (e) {
      console.error(`✗ ${e.message}`);
      console.error(`  Statement: ${stmt.replace(/\s+/g, " ").slice(0, 100)}`);
    }
  }
  console.log("\nMigration complete.");
}

migrate();

-- ancestry tables — ported from Neon to wv-port-pilot (trust-pool: wv-internal)
-- Source: pg_dump --schema-only from neon ancestry project (2026-04-27)
-- No ancestry_ prefix needed: no conflicts with port's existing tables.

CREATE TABLE IF NOT EXISTS trees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    owner_email text NOT NULL,
    visibility text DEFAULT 'private'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    layout_positions jsonb DEFAULT '{}'::jsonb,
    saved_views jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT trees_pkey PRIMARY KEY (id),
    CONSTRAINT trees_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text])))
);

CREATE TABLE IF NOT EXISTS persons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    sex text,
    is_living boolean DEFAULT true,
    privacy_level text DEFAULT 'private'::text,
    thumbnail_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dna_data jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT persons_pkey PRIMARY KEY (id),
    CONSTRAINT persons_privacy_level_check CHECK ((privacy_level = ANY (ARRAY['public'::text, 'authenticated'::text, 'family'::text, 'private'::text]))),
    CONSTRAINT persons_sex_check CHECK ((sex = ANY (ARRAY['M'::text, 'F'::text, 'X'::text, 'U'::text])))
);

CREATE TABLE IF NOT EXISTS places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    parent_id uuid,
    place_type text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT places_pkey PRIMARY KEY (id),
    CONSTRAINT places_place_type_check CHECK ((place_type = ANY (ARRAY['country'::text, 'state'::text, 'county'::text, 'city'::text, 'address'::text, 'cemetery'::text, 'church'::text, 'other'::text])))
);

CREATE TABLE IF NOT EXISTS sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    title text NOT NULL,
    author text,
    publisher text,
    source_type text,
    url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sources_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    event_type text NOT NULL,
    date jsonb,
    sort_date date,
    place_id uuid,
    description text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    person1_id uuid NOT NULL,
    person2_id uuid NOT NULL,
    relationship_type text NOT NULL,
    start_date jsonb,
    end_date jsonb,
    confidence smallint,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT relationships_pkey PRIMARY KEY (id),
    CONSTRAINT relationships_person1_id_person2_id_relationship_type_key UNIQUE (person1_id, person2_id, relationship_type),
    CONSTRAINT relationships_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT relationships_relationship_type_check CHECK ((relationship_type = ANY (ARRAY['biological_parent'::text, 'adoptive_parent'::text, 'foster_parent'::text, 'step_parent'::text, 'guardian'::text, 'godparent'::text, 'spouse'::text, 'partner'::text, 'ex_spouse'::text, 'other'::text])))
);

CREATE TABLE IF NOT EXISTS person_names (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    name_type text DEFAULT 'birth'::text,
    given_names text,
    surname text,
    prefix text,
    suffix text,
    display text,
    is_primary boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    CONSTRAINT person_names_pkey PRIMARY KEY (id),
    CONSTRAINT person_names_name_type_check CHECK ((name_type = ANY (ARRAY['birth'::text, 'married'::text, 'adopted'::text, 'alias'::text, 'nickname'::text, 'other'::text])))
);

CREATE TABLE IF NOT EXISTS place_names (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    name text NOT NULL,
    date_from date,
    date_to date,
    is_current boolean DEFAULT true,
    CONSTRAINT place_names_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS citations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    event_id uuid,
    page text,
    confidence text,
    "extract" text,
    notes text,
    CONSTRAINT citations_pkey PRIMARY KEY (id),
    CONSTRAINT citations_confidence_check CHECK ((confidence = ANY (ARRAY['primary'::text, 'secondary'::text, 'questionable'::text, 'unreliable'::text])))
);

CREATE TABLE IF NOT EXISTS media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    file_url text NOT NULL,
    file_type text,
    title text,
    description text,
    date jsonb,
    uploaded_at timestamp with time zone DEFAULT now(),
    CONSTRAINT media_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS media_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_id uuid NOT NULL,
    person_id uuid,
    event_id uuid,
    source_id uuid,
    sort_order integer DEFAULT 0,
    CONSTRAINT media_links_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    person_id uuid NOT NULL,
    source_system text NOT NULL,
    external_id text NOT NULL,
    match_data jsonb NOT NULL,
    confidence smallint NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    evidence jsonb,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    CONSTRAINT hints_pkey PRIMARY KEY (id),
    CONSTRAINT hints_person_id_source_system_external_id_key UNIQUE (person_id, source_system, external_id),
    CONSTRAINT hints_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT hints_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])))
);

CREATE TABLE IF NOT EXISTS comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    author_email text NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    parent_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT comments_pkey PRIMARY KEY (id),
    CONSTRAINT comments_target_type_check CHECK ((target_type = ANY (ARRAY['person'::text, 'event'::text, 'source'::text, 'relationship'::text])))
);

CREATE TABLE IF NOT EXISTS activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    actor_email text NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id uuid,
    target_name text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS tree_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    member_email text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tree_members_pkey PRIMARY KEY (id),
    CONSTRAINT tree_members_tree_id_member_email_key UNIQUE (tree_id, member_email),
    CONSTRAINT tree_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])))
);

CREATE TABLE IF NOT EXISTS research_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    person_id uuid,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text,
    priority text DEFAULT 'medium'::text,
    source text,
    hint_id uuid,
    due_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT research_tasks_pkey PRIMARY KEY (id),
    CONSTRAINT research_tasks_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT research_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text, 'dismissed'::text])))
);

CREATE TABLE IF NOT EXISTS notification_prefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    email text NOT NULL,
    immediate boolean DEFAULT true NOT NULL,
    digest boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_prefs_pkey PRIMARY KEY (id),
    CONSTRAINT notification_prefs_tree_id_email_key UNIQUE (tree_id, email)
);

CREATE TABLE IF NOT EXISTS notification_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    first_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    last_actor_email text,
    activity_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT notification_queue_pkey PRIMARY KEY (id),
    CONSTRAINT notification_queue_tree_id_key UNIQUE (tree_id)
);

CREATE TABLE IF NOT EXISTS notification_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tree_id uuid NOT NULL,
    email text NOT NULL,
    send_type text NOT NULL,
    week_start date,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_sends_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS prowl_state (
    id text DEFAULT 'session'::text NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT prowl_state_pkey PRIMARY KEY (id)
);

-- Foreign keys (all referenced tables exist above)

ALTER TABLE ONLY persons
    ADD CONSTRAINT persons_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY places
    ADD CONSTRAINT places_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY places
    ADD CONSTRAINT places_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES places(id);

ALTER TABLE ONLY sources
    ADD CONSTRAINT sources_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY events
    ADD CONSTRAINT events_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY events
    ADD CONSTRAINT events_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id);

ALTER TABLE ONLY relationships
    ADD CONSTRAINT relationships_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY relationships
    ADD CONSTRAINT relationships_person1_id_fkey FOREIGN KEY (person1_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY relationships
    ADD CONSTRAINT relationships_person2_id_fkey FOREIGN KEY (person2_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY person_names
    ADD CONSTRAINT person_names_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY place_names
    ADD CONSTRAINT place_names_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;

ALTER TABLE ONLY citations
    ADD CONSTRAINT citations_source_id_fkey FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE;

ALTER TABLE ONLY citations
    ADD CONSTRAINT citations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE ONLY media
    ADD CONSTRAINT media_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY media_links
    ADD CONSTRAINT media_links_media_id_fkey FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE;

ALTER TABLE ONLY media_links
    ADD CONSTRAINT media_links_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY media_links
    ADD CONSTRAINT media_links_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE ONLY media_links
    ADD CONSTRAINT media_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE;

ALTER TABLE ONLY hints
    ADD CONSTRAINT hints_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY hints
    ADD CONSTRAINT hints_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;

ALTER TABLE ONLY activity_log
    ADD CONSTRAINT activity_log_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY tree_members
    ADD CONSTRAINT tree_members_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY research_tasks
    ADD CONSTRAINT research_tasks_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY research_tasks
    ADD CONSTRAINT research_tasks_person_id_fkey FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE ONLY research_tasks
    ADD CONSTRAINT research_tasks_hint_id_fkey FOREIGN KEY (hint_id) REFERENCES hints(id) ON DELETE SET NULL;

ALTER TABLE ONLY notification_prefs
    ADD CONSTRAINT notification_prefs_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY notification_queue
    ADD CONSTRAINT notification_queue_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

ALTER TABLE ONLY notification_sends
    ADD CONSTRAINT notification_sends_tree_id_fkey FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE;

-- Indexes

CREATE INDEX IF NOT EXISTS idx_persons_tree ON persons USING btree (tree_id);
CREATE INDEX IF NOT EXISTS idx_person_names_person ON person_names USING btree (person_id);
CREATE INDEX IF NOT EXISTS idx_person_names_search ON person_names USING btree (lower(surname), lower(given_names));
CREATE INDEX IF NOT EXISTS idx_events_person ON events USING btree (person_id);
CREATE INDEX IF NOT EXISTS idx_events_sort ON events USING btree (sort_date);
CREATE INDEX IF NOT EXISTS idx_events_type ON events USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_relationships_tree ON relationships USING btree (tree_id);
CREATE INDEX IF NOT EXISTS idx_relationships_person1 ON relationships USING btree (person1_id);
CREATE INDEX IF NOT EXISTS idx_relationships_person2 ON relationships USING btree (person2_id);
CREATE INDEX IF NOT EXISTS idx_place_names_place ON place_names USING btree (place_id);
CREATE INDEX IF NOT EXISTS idx_hints_tree ON hints USING btree (tree_id, status, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_hints_person ON hints USING btree (person_id, status);
CREATE INDEX IF NOT EXISTS idx_hints_person_status ON hints USING btree (person_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_tree ON comments USING btree (tree_id);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments USING btree (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_activity_tree ON activity_log USING btree (tree_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tree_members_tree ON tree_members USING btree (tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_members_email ON tree_members USING btree (member_email);
CREATE INDEX IF NOT EXISTS idx_research_tasks_tree ON research_tasks USING btree (tree_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_person ON research_tasks USING btree (person_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_notification_sends_dedup ON notification_sends USING btree (tree_id, email, send_type, week_start);

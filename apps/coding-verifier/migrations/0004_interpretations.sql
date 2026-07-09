-- 0004_interpretations.sql — layer 2 (interpretation / triangulation).
-- once a claim's evidence passes layer 1 (verified/adjudicated), reviewers read it through
-- up to three complementary lenses. this is triangulation on already-verified evidence — a
-- different validity move from the layer-1 reliability check, kept in its own table.
-- no foreign key (consistent with 0003; the app only writes valid claim_ids), index on claim_id.
-- apply with: wrangler d1 execute wv-coding-verifier --remote --file=migrations/0004_interpretations.sql

create table if not exists interpretations (
  id          integer primary key autoincrement,
  claim_id    integer not null,
  lens        text    not null check (lens in ('psychometric','practitioner','collective')),
  reviewer    text    not null,                    -- signed-in email
  note        text    not null,
  weight      text            check (weight in ('strong','moderate','tentative')),  -- optional confidence
  created_at  text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create index if not exists idx_interp_claim on interpretations(claim_id);
create index if not exists idx_interp_lens  on interpretations(lens);

-- 0003_relax_reviewer.sql — reviewer is now a google email, not a fixed garrett/jamie enum.
-- sqlite can't drop a CHECK constraint in place, so rebuild `claims` preserving its 9 rows.
-- audit_log.reviewer was already unconstrained, so it needs no change.
-- apply with: wrangler d1 execute wv-coding-verifier --remote --file=migrations/0003_relax_reviewer.sql

create table claims_new (
  id              integer primary key autoincrement,
  engagement      text    not null default 'amna-at-10',
  claim_text      text    not null,
  conjecture_ref  text,
  source_file     text    not null,
  location        text,
  coder_a_excerpt text,
  coder_b_excerpt text,
  carl_excerpt    text,
  agreement       text    check (agreement in ('agree','disagree','partial')),
  status          text    not null default 'pending'
                          check (status in ('pending','verified','flagged','adjudicated')),
  reviewer        text,                             -- now any signed-in email
  ruling          text,
  notes           text,
  drive_link      text,
  verified_at     text,
  created_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

insert into claims_new
  select id, engagement, claim_text, conjecture_ref, source_file, location,
         coder_a_excerpt, coder_b_excerpt, carl_excerpt, agreement, status, reviewer,
         ruling, notes, drive_link, verified_at, created_at, updated_at
  from claims;

drop table claims;
alter table claims_new rename to claims;

create index if not exists idx_claims_status     on claims(status);
create index if not exists idx_claims_engagement on claims(engagement);

-- 0003_relax_reviewer.sql — reviewer is now a google email, not a fixed garrett/jamie enum.
-- sqlite can't drop a CHECK constraint in place, so we rebuild the affected tables.
--
-- two rebuilds, in this order:
--   (b) audit_log — drop its foreign key to claims(id) first, otherwise it blocks the
--       claims drop below (d1 enforces FKs in autocommit; PRAGMA defer doesn't stick).
--       the app only ever writes valid claim_ids, so the FK was belt-and-braces; we keep
--       the claim_id index for lookups.
--   (a) claims — drop the reviewer CHECK so any signed-in email can be recorded.
-- ids are preserved throughout, so the audit trail stays linked by claim_id.

-- (b) rebuild audit_log without the foreign key -------------------------------
create table audit_log_new (
  id          integer primary key autoincrement,
  claim_id    integer not null,
  action      text    not null,
  from_status text,
  to_status   text,
  reviewer    text,
  note        text,
  at          text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
insert into audit_log_new (id, claim_id, action, from_status, to_status, reviewer, note, at)
  select id, claim_id, action, from_status, to_status, reviewer, note, at from audit_log;
drop table audit_log;
alter table audit_log_new rename to audit_log;
create index if not exists idx_audit_claim on audit_log(claim_id);

-- (a) rebuild claims without the reviewer CHECK -------------------------------
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

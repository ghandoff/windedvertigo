-- 0001_init.sql — schema for the evidence verification console.
-- two tables: claims (the queue) + audit_log (append-only trail).
-- d1 / sqlite dialect. apply with: npm run db:init  (step 3, needs approval).

create table if not exists claims (
  id              integer primary key autoincrement,
  engagement      text    not null default 'amna-at-10',
  claim_text      text    not null,                 -- short claim label
  conjecture_ref  text,                             -- programme-theory code
  source_file     text    not null,
  location        text,                             -- page / section
  coder_a_excerpt text,                             -- anchor quote where coder a confirmed (else null)
  coder_b_excerpt text,                             -- anchor quote where coder b confirmed (else null)
  carl_excerpt    text,                             -- anchor quote where carl direct-read (else null)
  agreement       text    check (agreement in ('agree','disagree','partial')),
  status          text    not null default 'pending'
                          check (status in ('pending','verified','flagged','adjudicated')),
  reviewer        text    check (reviewer in ('garrett','jamie')),
  ruling          text,
  notes           text,
  drive_link      text,                             -- optional drive url (app can't open local files)
  verified_at     text,                             -- iso8601, set on verify/adjudicate
  created_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create index if not exists idx_claims_status     on claims(status);
create index if not exists idx_claims_engagement on claims(engagement);

create table if not exists audit_log (
  id          integer primary key autoincrement,
  claim_id    integer not null references claims(id),
  action      text    not null,                     -- 'seed' | 'verify' | 'flag' | 'adjudicate'
  from_status text,
  to_status   text,
  reviewer    text,
  note        text,
  at          text    not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
create index if not exists idx_audit_claim on audit_log(claim_id);

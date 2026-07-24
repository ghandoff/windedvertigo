-- soundings — phase 1 "sounding board": voice-first async feedback on RFP
-- one-pagers (and manually-created docs), collected in Slack threads before
-- the wednesday whirlpool (jul 21/22 decisions; docs/soundings/build-brief.md).
--
-- three tables:
--   soundings          — one feedback request per slack thread. status:
--                        open → digested (digest posted) → closed (human) ;
--                        open → expired (deadline passed with zero notes —
--                        graceful, silence = consent, no shame states).
--   sounding_reviewers — per-reviewer response/reminder state. reminded_at
--                        enforces ONE reminder max via a conditional update
--                        (update … where reminded_at is null); passed_at
--                        records a 🙅 pass as a real, penalty-free response.
--   sounding_items     — one row per captured reply (voice note / text / pass).
--                        terminal states: integrated | declined | expired.
--                        declined REQUIRES a non-empty reason (CHECK below) —
--                        "declined with reason" is respect, not rejection.
--                        unique indexes on (sounding, user, msg ts) and on
--                        slack_file_id make slack's at-least-once event
--                        delivery (and the cron catch-up sweep) idempotent.
--
-- questions live as jsonb on soundings ([{text, asked_by_type, asked_by_name}])
-- — write-once, always read with the parent; provenance (human 👤 vs agent 🤖)
-- carried per element (jamie's requirement: humans honor human questions).
--
-- zero gamification by design: no counters, no streaks, no per-reviewer
-- scores. receipts (receipt_sent_at) are the only reviewer-facing feedback.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

begin;

create table if not exists soundings (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null default 'rfp' check (source in ('rfp', 'manual')),
  rfp_notion_page_id text,            -- set when source='rfp'; no FK (rfp_opportunities keyed by notion_page_id)
  doc_title          text not null,
  doc_url            text,            -- port deep-link (rfp-radar/<id>) or arbitrary doc url
  slack_channel_id   text not null,
  slack_thread_ts    text not null,   -- root message ts; replies correlate on (channel, thread_ts)
  kickoff_msg_ts     text,            -- ts of the kickoff thread reply (audit)
  questions          jsonb not null default '[]'::jsonb,
  status             text not null default 'open'
                       check (status in ('open', 'digested', 'closed', 'expired')),
  deadline_at        timestamptz not null,
  digested_at        timestamptz,
  digest_json        jsonb,           -- parsed claude output (themes/conflicts/actions)
  digest_posted_ts   text,            -- slack ts of the posted digest reply
  closed_at          timestamptz,
  created_by         text,            -- email; null when auto-created by the rfp defer flow
  created_at         timestamptz not null default now()
);

create unique index if not exists soundings_channel_thread_uidx
  on soundings (slack_channel_id, slack_thread_ts);
create index if not exists soundings_status_deadline_idx
  on soundings (status, deadline_at);
create index if not exists soundings_rfp_notion_page_id_idx
  on soundings (rfp_notion_page_id);

create table if not exists sounding_reviewers (
  id            uuid primary key default gen_random_uuid(),
  sounding_id   uuid not null references soundings(id) on delete cascade,
  email         text not null,
  slack_user_id text,               -- resolved at create time; may be null if lookup failed
  responded_at  timestamptz,        -- first response of ANY kind (voice/text/pass)
  passed_at     timestamptz,        -- set when the response was a 🙅 pass
  reminded_at   timestamptz,        -- ONE reminder max: sweep updates where reminded_at is null
  created_at    timestamptz not null default now(),
  unique (sounding_id, email)
);

create index if not exists sounding_reviewers_sounding_id_idx
  on sounding_reviewers (sounding_id);

create table if not exists sounding_items (
  id                 uuid primary key default gen_random_uuid(),
  sounding_id        uuid not null references soundings(id) on delete cascade,
  slack_user_id      text not null,
  reviewer_email     text,           -- resolved via users.info (users:read.email); null if unresolvable
  kind               text not null check (kind in ('voice', 'text', 'pass')),
  slack_msg_ts       text not null,  -- reply ts; for a pass-reaction, the ts of the reacted message
  slack_file_id      text,           -- voice notes: slack file id (idempotency anchor)
  audio_r2_key       text,           -- soundings/<sounding_id>/<file_id>.<ext>
  audio_r2_url       text,
  audio_content_type text,
  text_body          text,           -- kind='text': the raw slack message text
  transcript         text,
  transcript_status  text not null default 'done'
                       check (transcript_status in ('pending', 'done', 'failed')),
  transcript_error   text,
  status             text not null default 'new'
                       check (status in ('new', 'integrated', 'declined', 'expired')),
  status_reason      text,           -- REQUIRED for declined (check below); "what changed" note otherwise
  status_set_by      text,           -- email of the human who triaged
  status_set_at      timestamptz,
  receipt_sent_at    timestamptz,
  created_at         timestamptz not null default now(),
  constraint sounding_items_declined_reason_chk
    check (status <> 'declined' or (status_reason is not null and length(trim(status_reason)) > 0))
);

-- Two reviewers 🙅-ing the same root message share slack_msg_ts — the user id
-- must be part of the uniqueness key.
create unique index if not exists sounding_items_user_msg_uidx
  on sounding_items (sounding_id, slack_user_id, slack_msg_ts);
create unique index if not exists sounding_items_file_uidx
  on sounding_items (slack_file_id) where slack_file_id is not null;
create index if not exists sounding_items_sounding_created_idx
  on sounding_items (sounding_id, created_at);
create index if not exists sounding_items_receipt_due_idx
  on sounding_items (status) where receipt_sent_at is null;

-- Same pattern as every other agent table: RLS enabled, no policies —
-- service-role-only access via lib/supabase/client.ts, gated by the API
-- routes/crons that call it.
alter table public.soundings enable row level security;
alter table public.sounding_reviewers enable row level security;
alter table public.sounding_items enable row level security;

commit;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- select table_name, column_name, data_type from information_schema.columns
-- where table_name in ('soundings','sounding_reviewers','sounding_items')
-- order by table_name, ordinal_position;

-- ── ROLLBACK (run only to undo) ──────────────────────────────────────────────
-- drop table if exists sounding_items;
-- drop table if exists sounding_reviewers;
-- drop table if exists soundings;

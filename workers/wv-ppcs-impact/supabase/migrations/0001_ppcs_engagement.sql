-- =======================================================================
-- PRME Pedagogy Certificate Series 2026 — Engagement Evidence Schema
-- Postgres port of PPCS2026_engagement_schema.sql
-- Target: NEW Supabase project (e.g. "wv-ppcs") — not the wv-booking project.
--
-- Privacy model
--   All base tables: RLS enabled, anon role blocked.
--   Only dashboard_metrics() is reachable externally, and only via the
--   Worker (service key) — not via anon/public PostgREST.
--
-- Apply with:
--   psql "$SUPABASE_DB_URL" -f 0001_ppcs_engagement.sql
--   (or paste into Supabase SQL editor)
-- =======================================================================

-- ── 1. DIMENSIONS ──────────────────────────────────────────────────────

create table participant (
  participant_id  text primary key,
  canonical_name  text,
  first_name      text,
  last_name       text,
  primary_email   text,
  organization    text,
  job_title       text,
  country         text,
  role            text,                     -- faculty | staff | student | facilitator | guest
  is_facilitator  int2 not null default 0,  -- 1 = wv/PRME team; excluded from participant KPIs
  consent_gdpr    int2,
  created_at      timestamptz not null default now(),
  notes           text
);
create index ix_participant_email on participant(primary_email);
alter table participant enable row level security;
create policy "no_anon" on participant as restrictive for all to anon using (false);

create table participant_alias (
  alias_id         int8 generated always as identity primary key,
  participant_id   text references participant(participant_id),
  source           text not null,           -- zoom_attendee | zoom_chat | commons | qualtrics | miro
  raw_display_name text,
  raw_email        text,
  raw_handle       text,
  match_method     text,                    -- email_exact | name_exact | name_fuzzy | manual | unresolved
  match_confidence float8,
  resolved_by      text,
  resolved_at      timestamptz,
  unique (source, raw_display_name, raw_email, raw_handle)
);
create index ix_alias_participant on participant_alias(participant_id);
create index ix_alias_source on participant_alias(source);
alter table participant_alias enable row level security;
create policy "no_anon" on participant_alias as restrictive for all to anon using (false);

create table week (
  week_no           int2 primary key,
  arc_title         text,
  theme             text,
  session_date      date,
  commons_board_url text
);
alter table week enable row level security;
create policy "no_anon" on week as restrictive for all to anon using (false);

create table session_event (
  session_event_id  int8 generated always as identity primary key,
  week_no           int2 references week(week_no),
  cohort            text,                   -- '09am' | '06pm'
  zoom_webinar_id   text,
  start_utc         timestamptz,
  duration_min      int4,
  n_registrants     int4,
  n_unique_viewers  int4,
  max_concurrent    int4,
  unique (week_no, cohort)
);
alter table session_event enable row level security;
create policy "no_anon" on session_event as restrictive for all to anon using (false);

create table lesson (
  lesson_code     text primary key,         -- '1A','1B',...,'5B'
  week_no         int2 references week(week_no),
  am_pm           text,
  title           text,
  used_miro       int2 not null default 0,
  miro_frame_name text
);
alter table lesson enable row level security;
create policy "no_anon" on lesson as restrictive for all to anon using (false);

-- ── 2. ENGAGEMENT FACTS ────────────────────────────────────────────────

create table attendance (
  attendance_id     int8 generated always as identity primary key,
  participant_id    text references participant(participant_id),
  session_event_id  int8 references session_event(session_event_id),
  attended          int2,
  registration_time timestamptz,
  approval_status   text,
  first_join        timestamptz,
  last_leave        timestamptz,
  total_minutes     int4,
  is_guest          int2,
  party_role        text,                   -- attendee | panelist | host
  unique (participant_id, session_event_id)
);
create index ix_att_session on attendance(session_event_id);
alter table attendance enable row level security;
create policy "no_anon" on attendance as restrictive for all to anon using (false);

create table attendance_interval (
  interval_id   int8 generated always as identity primary key,
  attendance_id int8 references attendance(attendance_id),
  join_time     timestamptz,
  leave_time    timestamptz,
  minutes       int4
);
alter table attendance_interval enable row level security;
create policy "no_anon" on attendance_interval as restrictive for all to anon using (false);

create table chat_message (
  message_id        int8 generated always as identity primary key,
  session_event_id  int8 references session_event(session_event_id),
  participant_id    text references participant(participant_id),
  raw_display_name  text not null,
  ts_offset         interval,               -- offset from session start
  ts_utc            timestamptz,
  message_text      text,
  char_count        int4,
  word_count        int4,
  is_question       int2,
  addressed_to      text
);
create index ix_chat_session on chat_message(session_event_id);
create index ix_chat_participant on chat_message(participant_id);
alter table chat_message enable row level security;
create policy "no_anon" on chat_message as restrictive for all to anon using (false);

create table commons_thread (
  thread_id              text primary key,
  week_no                int2 references week(week_no),
  title                  text,
  starter_participant_id text references participant(participant_id),
  created_at             timestamptz,
  url                    text
);
alter table commons_thread enable row level security;
create policy "no_anon" on commons_thread as restrictive for all to anon using (false);

create table commons_contribution (
  contribution_id        text primary key,
  thread_id              text references commons_thread(thread_id),
  week_no                int2 references week(week_no),
  participant_id         text references participant(participant_id),
  parent_contribution_id text references commons_contribution(contribution_id),
  contribution_type      text,              -- post | comment | reply
  depth                  int2,
  body                   text,
  created_at             timestamptz,
  word_count             int4,
  url                    text
);
create index ix_commons_thread on commons_contribution(thread_id);
create index ix_commons_participant on commons_contribution(participant_id);
create index ix_commons_parent on commons_contribution(parent_contribution_id);
alter table commons_contribution enable row level security;
create policy "no_anon" on commons_contribution as restrictive for all to anon using (false);

create table miro_contribution (
  item_id         text primary key,
  lesson_code     text references lesson(lesson_code),
  frame_name      text,
  participant_id  text references participant(participant_id),
  raw_author      text,
  item_type       text,                     -- sticky_note | text | shape
  text            text,
  created_at      timestamptz
);
create index ix_miro_lesson on miro_contribution(lesson_code);
alter table miro_contribution enable row level security;
create policy "no_anon" on miro_contribution as restrictive for all to anon using (false);

-- ── 3. SURVEY / MEASURES ───────────────────────────────────────────────

create table survey (
  survey_id           int8 generated always as identity primary key,
  qualtrics_survey_id text,
  name                text,
  purpose             text,                 -- feedback | pre | post | baseline
  week_no             int2 references week(week_no),
  lesson_code         text references lesson(lesson_code),
  opened_at           date
);
alter table survey enable row level security;
create policy "no_anon" on survey as restrictive for all to anon using (false);

create table survey_response (
  response_id           int8 generated always as identity primary key,
  survey_id             int8 references survey(survey_id),
  participant_id        text references participant(participant_id),
  qualtrics_response_id text,
  recorded_at           timestamptz,
  finished              int2,
  consent_gdpr          int2,
  recipient_email       text,
  recipient_first_name  text,
  recipient_last_name   text,
  raw_name_inst         text,
  ip_address            text
);
create index ix_resp_survey on survey_response(survey_id);
alter table survey_response enable row level security;
create policy "no_anon" on survey_response as restrictive for all to anon using (false);

create table survey_answer (
  answer_id      int8 generated always as identity primary key,
  response_id    int8 references survey_response(response_id),
  item_code      text,
  question_text  text,
  answer_text    text,
  answer_numeric float8,
  is_open_ended  int2 not null default 0
);
create index ix_ans_response on survey_answer(response_id);
alter table survey_answer enable row level security;
create policy "no_anon" on survey_answer as restrictive for all to anon using (false);

create table measure_long (
  measure_row_id int8 generated always as identity primary key,
  participant_id text references participant(participant_id),
  cohort         text,
  session_code   text references lesson(lesson_code),
  timepoint      text,
  measure        text,
  item           text,
  skill_focus    text,
  score          float8,
  measure_type   text
);
alter table measure_long enable row level security;
create policy "no_anon" on measure_long as restrictive for all to anon using (false);

-- ── 4. TEXT-ANALYSIS LAYER ─────────────────────────────────────────────

create table sentiment_annotation (
  annotation_id   int8 generated always as identity primary key,
  source_type     text not null,            -- chat | commons | survey_open | miro
  source_id       text not null,            -- PK value in the source table
  model           text,
  sentiment_label text,
  sentiment_score float8,
  emotion         text,
  confidence      float8,
  created_at      timestamptz not null default now()
);
create index ix_sent_source on sentiment_annotation(source_type, source_id);
alter table sentiment_annotation enable row level security;
create policy "no_anon" on sentiment_annotation as restrictive for all to anon using (false);

create table code (
  code_id        int8 generated always as identity primary key,
  theme          text,
  code_name      text,
  definition     text,
  parent_code_id int8 references code(code_id),
  arc_theme      text,
  dashboard_label text        -- short display name used in /api/metrics (NULL = use code_name)
);
alter table code enable row level security;
create policy "no_anon" on code as restrictive for all to anon using (false);

create table coding (
  coding_id   int8 generated always as identity primary key,
  source_type text not null,
  source_id   text not null,
  code_id     int8 references code(code_id),
  coder       text,
  memo        text,
  created_at  timestamptz not null default now()
);
create index ix_coding_source on coding(source_type, source_id);
create index ix_coding_code on coding(code_id);
alter table coding enable row level security;
create policy "no_anon" on coding as restrictive for all to anon using (false);

-- ── 5. SERIES CONFIG (manual overrides for metrics not derivable from DB) ──
-- Update a value:  UPDATE series_config SET value='142', updated_at=now() WHERE key='intro_poll_n';

create table series_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
insert into series_config (key, value, updated_at) values
  ('intro_poll_n', '141', now());
alter table series_config enable row level security;
create policy "no_anon" on series_config as restrictive for all to anon using (false);

-- ── 6. ANALYTIC VIEWS ──────────────────────────────────────────────────

create or replace view v_text_unit as
  select 'chat' as source_type,
         cm.message_id::text as source_id,
         cm.participant_id,
         cm.session_event_id,
         null::int2 as week_no,
         cm.message_text as text
    from chat_message cm
  union all
  select 'commons',
         cc.contribution_id,
         cc.participant_id,
         null,
         cc.week_no,
         cc.body
    from commons_contribution cc
  union all
  select 'survey_open',
         a.answer_id::text,
         r.participant_id,
         null,
         s.week_no,
         a.answer_text
    from survey_answer a
    join survey_response r on r.response_id = a.response_id
    join survey s on s.survey_id = r.survey_id
   where a.is_open_ended = 1
  union all
  select 'miro',
         mc.item_id,
         mc.participant_id,
         null,
         null::int2,
         mc.text
    from miro_contribution mc;

create or replace view v_engagement_per_user_week as
  select p.participant_id,
         w.week_no,
         coalesce(att.total_minutes, 0)   as attend_minutes,
         coalesce(ch.msg_count, 0)        as chat_messages,
         coalesce(cm.post_count, 0)       as commons_posts,
         coalesce(cm.comment_count, 0)    as commons_comments,
         coalesce(cm.reply_count, 0)      as commons_replies,
         coalesce(mi.miro_items, 0)       as miro_items
    from participant p
   cross join week w
    left join (
      select a.participant_id, se.week_no, sum(a.total_minutes) as total_minutes
        from attendance a join session_event se on se.session_event_id = a.session_event_id
       group by a.participant_id, se.week_no
    ) att on att.participant_id = p.participant_id and att.week_no = w.week_no
    left join (
      select c.participant_id, se.week_no, count(*) as msg_count
        from chat_message c join session_event se on se.session_event_id = c.session_event_id
       group by c.participant_id, se.week_no
    ) ch on ch.participant_id = p.participant_id and ch.week_no = w.week_no
    left join (
      select participant_id, week_no,
             count(*) filter (where contribution_type = 'post')    as post_count,
             count(*) filter (where contribution_type = 'comment') as comment_count,
             count(*) filter (where contribution_type = 'reply')   as reply_count
        from commons_contribution
       group by participant_id, week_no
    ) cm on cm.participant_id = p.participant_id and cm.week_no = w.week_no
    left join (
      select m.participant_id, l.week_no, count(*) as miro_items
        from miro_contribution m join lesson l on l.lesson_code = m.lesson_code
       group by m.participant_id, l.week_no
    ) mi on mi.participant_id = p.participant_id and mi.week_no = w.week_no;

-- Postgres-native recursive threaded Commons view
create or replace view v_commons_thread_tree as
  with recursive tree as (
    select contribution_id, thread_id, parent_contribution_id, participant_id,
           contribution_type, depth, body, created_at,
           coalesce(created_at::text, '') as sort_path
      from commons_contribution
     where parent_contribution_id is null
    union all
    select c.contribution_id, c.thread_id, c.parent_contribution_id, c.participant_id,
           c.contribution_type, c.depth, c.body, c.created_at,
           t.sort_path || '|' || coalesce(c.created_at::text, '')
      from commons_contribution c
      join tree t on c.parent_contribution_id = t.contribution_id
  )
  select * from tree order by thread_id, sort_path;

-- ── 7. DASHBOARD METRICS FUNCTION ──────────────────────────────────────
-- Returns the exact JSON shape the dashboard expects as const D.
-- security definer  → runs as postgres, bypassing RLS on base tables.
-- No GRANT to anon  → anon cannot reach it via PostgREST.
-- The Worker is the only caller (service key → service_role).
--
-- Route: POST /rest/v1/rpc/dashboard_metrics   (empty body {})
-- Cached at CF edge for 10 min.

create or replace function dashboard_metrics()
returns jsonb
language sql
security definer
stable
as $$
with
-- ── session_event registrant counts (aggregated BEFORE joining attendance,
--    to avoid multiplication: n_registrants × attendance-row-count per session)
session_reg as (
  select week_no,
         sum(n_registrants)                                     as registrants,
         sum(n_registrants) filter (where cohort = '09am')     as reg_9am,
         sum(n_registrants) filter (where cohort = '06pm')     as reg_6pm
  from session_event
  group by week_no
),
-- ── attendance counts per week (including facilitators; both cohorts summed)
weekly_att as (
  select se.week_no,
         count(*) filter (where a.attended = 1)                           as attended,
         count(*) filter (where a.attended = 1 and se.cohort = '09am')    as att_9am,
         count(*) filter (where a.attended = 1 and se.cohort = '06pm')    as att_6pm
  from attendance a
  join session_event se on se.session_event_id = a.session_event_id
  group by se.week_no
),
-- ── combined weekly view
weekly as (
  select w.week_no, w.attended, w.att_9am, w.att_6pm,
         r.registrants, r.reg_9am, r.reg_6pm
  from weekly_att w join session_reg r on r.week_no = w.week_no
),
-- ── per-session cohort attendance
sessions as (
  select se.week_no, se.cohort,
         count(*) filter (where a.attended = 1) as attended
  from attendance a
  join session_event se on se.session_event_id = a.session_event_id
  group by se.week_no, se.cohort
),
-- ── commons contributions by week
commons as (
  select week_no,
         count(*) filter (where contribution_type = 'post')    as posts,
         count(*) filter (where contribution_type = 'comment') as comments,
         count(*) filter (where contribution_type = 'reply')   as replies
  from commons_contribution
  group by week_no
),
-- ── sentiment: weekly mean VADER compound (chat + commons)
sent as (
  select
    coalesce(se.week_no, cc.week_no) as week_no,
    sa.sentiment_score
  from sentiment_annotation sa
  left join chat_message cm
    on sa.source_type = 'chat' and sa.source_id = cm.message_id::text
  left join session_event se on se.session_event_id = cm.session_event_id
  left join commons_contribution cc
    on sa.source_type = 'commons' and sa.source_id = cc.contribution_id
  where coalesce(se.week_no, cc.week_no) is not null
),
sent_agg as (
  select week_no, round(avg(sentiment_score)::numeric, 3)::float8 as mean_sent
  from sent
  group by week_no
),
-- ── PRIME prevalence (% of full text corpus per principle)
corpus_n as (
  select count(*) as n
  from v_text_unit
  where text is not null and trim(text) <> ''
),
prime as (
  select replace(c.code_name, 'PRIME: ', '') as p,
         round(
           (count(distinct cd.source_type || cd.source_id) * 100.0 /
            nullif((select n from corpus_n), 0))::numeric, 1
         )::float8 as v
  from coding cd
  join code c on c.code_id = cd.code_id
  where c.arc_theme = 'PRIME design principle'
    and cd.coder = 'ai-firstpass-prime'
  group by c.code_id, c.code_name
  order by count(distinct cd.source_type || cd.source_id) desc
),
-- ── weekly unit denominator for theme % (chat + commons only)
week_units as (
  select
    case when u.source_type = 'chat'    then se.week_no
         when u.source_type = 'commons' then cc.week_no end as week_no,
    count(*) as n
  from v_text_unit u
  left join chat_message cm on u.source_type = 'chat' and u.source_id = cm.message_id::text
  left join session_event se on se.session_event_id = cm.session_event_id
  left join commons_contribution cc
    on u.source_type = 'commons' and u.source_id = cc.contribution_id
  where u.text is not null and trim(u.text) <> ''
  group by 1
),
-- ── theme counts per week (deductive codes only: code_ids 1-5 in the arc order)
theme_counts as (
  select coalesce(c.dashboard_label, c.code_name) as theme_label,
         c.code_id,
         case when u.source_type = 'chat'    then se.week_no
              when u.source_type = 'commons' then cc.week_no end as week_no,
         count(distinct cd.source_type || cd.source_id) as tagged
  from coding cd
  join code c on c.code_id = cd.code_id
    and c.parent_code_id is null
    and c.arc_theme not like '%PRIME%'
    and c.arc_theme <> 'cross-cutting'
  join v_text_unit u on cd.source_type = u.source_type and cd.source_id = u.source_id
  left join chat_message cm on u.source_type = 'chat' and u.source_id = cm.message_id::text
  left join session_event se on se.session_event_id = cm.session_event_id
  left join commons_contribution cc
    on u.source_type = 'commons' and u.source_id = cc.contribution_id
  where case when u.source_type = 'chat'    then se.week_no
             when u.source_type = 'commons' then cc.week_no end between 1 and 5
  group by c.dashboard_label, c.code_name, c.code_id,
           case when u.source_type = 'chat'    then se.week_no
                when u.source_type = 'commons' then cc.week_no end
),
-- ── KPIs
kpi as (
  select
    count(distinct a.participant_id) filter (where p.is_facilitator = 0)                    as unique_registrants,
    count(distinct a.participant_id) filter (where a.attended = 1 and p.is_facilitator = 0) as unique_attendees,
    (select sum(att_9am)::numeric / nullif(sum(reg_9am), 0)
       from weekly) as rate_9am,
    (select sum(att_6pm)::numeric / nullif(sum(reg_6pm), 0)
       from weekly) as rate_6pm
  from attendance a
  join participant p on p.participant_id = a.participant_id
)
-- ── final JSON assembly
select jsonb_build_object(
  'weekly', (
    select jsonb_agg(
      jsonb_build_object(
        'week',        week_no,
        'registrants', registrants,
        'attended',    attended,
        'rate',        round(100.0 * attended / nullif(registrants, 0))::int
      ) order by week_no
    ) from weekly
  ),
  'sessions', (
    select jsonb_agg(
      jsonb_build_object('week', week_no, 'cohort', cohort, 'attended', attended)
      order by week_no, cohort
    ) from sessions
  ),
  'commons', (
    select jsonb_agg(
      jsonb_build_object('week', week_no, 'posts', posts, 'comments', comments, 'replies', replies)
      order by week_no
    ) from commons
  ),
  'sentiment', (
    select jsonb_agg(mean_sent order by week_no)
    from sent_agg where week_no between 1 and 5
  ),
  'prime', (select jsonb_agg(jsonb_build_object('p', p, 'v', v)) from prime),
  'themes', (
    select jsonb_agg(
      jsonb_build_object(
        't', theme_label,
        'd', (
          select jsonb_agg(
            round(100.0 * tc2.tagged / nullif(wu.n, 0))::int
            order by tc2.week_no
          )
          from theme_counts tc2
          join week_units wu on wu.week_no = tc2.week_no
          where tc2.code_id = outer_themes.code_id
            and tc2.week_no between 1 and 5
        )
      ) order by code_id
    )
    from (select distinct code_id, theme_label from theme_counts) outer_themes
  ),
  'kpis', (
    select jsonb_build_object(
      'unique_registrants', kpi.unique_registrants,
      'unique_attendees',   kpi.unique_attendees,
      'show_rate',          round(((kpi.rate_9am + kpi.rate_6pm) / 2.0) * 100)::int,
      'commons_contributions', (select count(*) from commons_contribution),
      'commons_authors',    (select count(distinct participant_id) from commons_contribution),
      'survey_n',           (select count(*) from survey_response),
      'intro_poll_n',       (select value::int from series_config where key = 'intro_poll_n')
    ) from kpi
  )
);
$$;

-- Remove the default PUBLIC execute grant, then grant only to authenticated.
-- service_role (the Worker) is authenticated; anon is blocked.
revoke execute on function dashboard_metrics() from public;
revoke execute on function dashboard_metrics() from anon;
grant execute on function dashboard_metrics() to authenticated;

-- ── 8. DEFENSE IN DEPTH: strip default table grants from public API roles ──
-- Supabase grants anon + authenticated full DML on every public table by
-- default, leaving RLS as the ONLY lock. For an identifiable dataset behind
-- a public dashboard we want two locks: no grant AND RLS. The Worker uses
-- service_role, which bypasses both, so the dashboard is unaffected.
do $$
declare r record;
begin
  for r in
    select tablename as relname from pg_tables where schemaname = 'public'
    union
    select viewname  from pg_views  where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;
-- Ensure future tables/views are not auto-exposed either
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ── CERTIFICATE COMPLETION (future table) ─────────────────────────────
-- When certificate data arrives, add a table like:
--
--   create table certificate_award (
--     cert_id        int8 generated always as identity primary key,
--     participant_id text references participant(participant_id),
--     cert_type      text,  -- 'practice' | 'applied_practice'
--     awarded_at     date,
--     cohort         text
--   );
--   alter table certificate_award enable row level security;
--   create policy "no_anon" on certificate_award as restrictive for all to anon using (false);
--
-- Then add cert_n to series_config or compute it in dashboard_metrics().

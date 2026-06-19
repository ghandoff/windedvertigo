-- =======================================================================
-- 0004_depth_and_benchmark.sql — reframe the "decline" narrative
--
-- Adds two keys to dashboard_metrics():
--   • reach_benchmark — a healthy-webinar show-rate band (40–60%) plus an
--     expected-attrition curve (week-1 show-rate decayed at a documented
--     per-session rate) so the actual line visibly outperforms typical decay.
--   • depth — per-week engagement QUALITY that headcount-driven raw counts
--     hide: responses per post, % of posts answered (thread liveliness),
--     contributions per active author, and % meeting the 3-contribution
--     certificate requirement.
--
-- Tunable assumption: EXPECTED_DECAY_PER_SESSION (default 0.12 = 12%/session,
-- a common session-over-session attendance heuristic for multi-session online
-- series). Change the 0.88 multiplier below to adjust.
--
-- Function-only change — no Worker redeploy needed; live on next cache cycle.
-- =======================================================================

create or replace function dashboard_metrics()
returns jsonb
language sql
security definer
stable
as $$
with
session_reg as (
  select week_no,
         sum(n_registrants)                                 as registrants,
         sum(n_registrants) filter (where cohort = '09am')  as reg_9am,
         sum(n_registrants) filter (where cohort = '06pm')  as reg_6pm
  from session_event
  group by week_no
),
weekly_att as (
  select se.week_no,
         count(*) filter (where a.attended = 1)                        as attended,
         count(*) filter (where a.attended = 1 and se.cohort = '09am') as att_9am,
         count(*) filter (where a.attended = 1 and se.cohort = '06pm') as att_6pm
  from attendance a
  join session_event se on se.session_event_id = a.session_event_id
  group by se.week_no
),
weekly as (
  select w.week_no, w.attended, w.att_9am, w.att_6pm,
         r.registrants, r.reg_9am, r.reg_6pm
  from weekly_att w join session_reg r on r.week_no = w.week_no
),
sessions as (
  select se.week_no, se.cohort,
         count(*) filter (where a.attended = 1) as attended
  from attendance a
  join session_event se on se.session_event_id = a.session_event_id
  group by se.week_no, se.cohort
),
commons as (
  select week_no,
         count(*) filter (where contribution_type = 'post')    as posts,
         count(*) filter (where contribution_type = 'comment') as comments,
         count(*) filter (where contribution_type = 'reply')   as replies
  from commons_contribution
  group by week_no
),
-- ── engagement DEPTH (quality, normalised) ───────────────────────────
commons_depth as (
  select week_no,
         count(distinct participant_id) as authors,
         round((count(*)::numeric / nullif(count(distinct participant_id), 0)), 2)::float8
           as per_author,
         round((count(*) filter (where contribution_type in ('comment','reply'))::numeric
                / nullif(count(*) filter (where contribution_type = 'post'), 0)), 2)::float8
           as responses_per_post
  from commons_contribution
  group by week_no
),
posts_answered as (
  select p.week_no,
         round(100.0 * count(*) filter (where exists (
             select 1 from commons_contribution r
              where r.thread_id = p.thread_id
                and r.contribution_type in ('comment','reply')
         )) / count(*))::int as pct_posts_answered
  from commons_contribution p
  where p.contribution_type = 'post'
  group by p.week_no
),
meeting_req as (
  select week_no,
         round(100.0 * count(*) filter (where n >= 3) / count(*))::int as pct_meeting_3plus
  from (
    select week_no, participant_id, count(*) as n
    from commons_contribution
    group by week_no, participant_id
  ) x
  group by week_no
),
sent as (
  select coalesce(se.week_no, cc.week_no) as week_no, sa.sentiment_score
  from sentiment_annotation sa
  left join chat_message cm on sa.source_type = 'chat' and sa.source_id = cm.message_id::text
  left join session_event se on se.session_event_id = cm.session_event_id
  left join commons_contribution cc on sa.source_type = 'commons' and sa.source_id = cc.contribution_id
  where coalesce(se.week_no, cc.week_no) is not null
),
sent_agg as (
  select week_no, round(avg(sentiment_score)::numeric, 3)::float8 as mean_sent
  from sent group by week_no
),
corpus_n as (
  select count(*) as n from v_text_unit where text is not null and trim(text) <> ''
),
prime as (
  select replace(c.code_name, 'PRIME: ', '') as p,
         round((count(distinct cd.source_type || cd.source_id) * 100.0 /
                nullif((select n from corpus_n), 0))::numeric, 1)::float8 as v
  from coding cd
  join code c on c.code_id = cd.code_id
  where c.arc_theme = 'PRIME design principle' and cd.coder = 'ai-firstpass-prime'
  group by c.code_id, c.code_name
  order by count(distinct cd.source_type || cd.source_id) desc
),
week_units as (
  select case when u.source_type = 'chat' then se.week_no
              when u.source_type = 'commons' then cc.week_no end as week_no,
         count(*) as n
  from v_text_unit u
  left join chat_message cm on u.source_type = 'chat' and u.source_id = cm.message_id::text
  left join session_event se on se.session_event_id = cm.session_event_id
  left join commons_contribution cc on u.source_type = 'commons' and u.source_id = cc.contribution_id
  where u.text is not null and trim(u.text) <> ''
  group by 1
),
theme_counts as (
  select coalesce(c.dashboard_label, c.code_name) as theme_label, c.code_id,
         case when u.source_type = 'chat' then se.week_no
              when u.source_type = 'commons' then cc.week_no end as week_no,
         count(distinct cd.source_type || cd.source_id) as tagged
  from coding cd
  join code c on c.code_id = cd.code_id
    and c.parent_code_id is null and c.arc_theme not like '%PRIME%' and c.arc_theme <> 'cross-cutting'
  join v_text_unit u on cd.source_type = u.source_type and cd.source_id = u.source_id
  left join chat_message cm on u.source_type = 'chat' and u.source_id = cm.message_id::text
  left join session_event se on se.session_event_id = cm.session_event_id
  left join commons_contribution cc on u.source_type = 'commons' and u.source_id = cc.contribution_id
  where case when u.source_type = 'chat' then se.week_no
             when u.source_type = 'commons' then cc.week_no end between 1 and 5
  group by c.dashboard_label, c.code_name, c.code_id,
           case when u.source_type = 'chat' then se.week_no
                when u.source_type = 'commons' then cc.week_no end
),
kpi as (
  select
    count(distinct a.participant_id) filter (where p.is_facilitator = 0)                    as unique_registrants,
    count(distinct a.participant_id) filter (where a.attended = 1 and p.is_facilitator = 0) as unique_attendees,
    (select sum(att_9am)::numeric / nullif(sum(reg_9am), 0) from weekly) as rate_9am,
    (select sum(att_6pm)::numeric / nullif(sum(reg_6pm), 0) from weekly) as rate_6pm
  from attendance a join participant p on p.participant_id = a.participant_id
)
select jsonb_build_object(
  'weekly', (
    select jsonb_agg(jsonb_build_object(
      'week', week_no, 'registrants', registrants, 'attended', attended,
      'rate', round(100.0 * attended / nullif(registrants, 0))::int
    ) order by week_no) from weekly
  ),
  'sessions', (
    select jsonb_agg(jsonb_build_object('week', week_no, 'cohort', cohort, 'attended', attended)
      order by week_no, cohort) from sessions
  ),
  'commons', (
    select jsonb_agg(jsonb_build_object('week', week_no, 'posts', posts, 'comments', comments, 'replies', replies)
      order by week_no) from commons
  ),
  -- engagement DEPTH (quality)
  'depth', (
    select jsonb_agg(jsonb_build_object(
      'week',               cd.week_no,
      'per_author',         cd.per_author,
      'responses_per_post', cd.responses_per_post,
      'pct_posts_answered', pa.pct_posts_answered,
      'pct_meeting_3plus',  mr.pct_meeting_3plus
    ) order by cd.week_no)
    from commons_depth cd
    join posts_answered pa on pa.week_no = cd.week_no
    join meeting_req   mr on mr.week_no = cd.week_no
  ),
  -- reach benchmark: healthy-webinar band + expected-attrition curve
  'reach_benchmark', jsonb_build_object(
    'band', jsonb_build_array(40, 60),          -- healthy single-webinar show-rate %
    'decay_pct_per_session', 12,                -- documented assumption
    'expected', (
      select jsonb_agg(
        round((100.0 * w1.attended / w1.registrants) * power(0.88, w.week_no - 1))::int
        order by w.week_no)
      from weekly w
      cross join (select attended, registrants from weekly where week_no = 1) w1
    )
  ),
  'sentiment', (
    select jsonb_agg(mean_sent order by week_no) from sent_agg where week_no between 1 and 5
  ),
  'prime', (select jsonb_agg(jsonb_build_object('p', p, 'v', v)) from prime),
  'themes', (
    select jsonb_agg(jsonb_build_object(
      't', theme_label,
      'd', (
        select jsonb_agg(round(100.0 * tc2.tagged / nullif(wu.n, 0))::int order by tc2.week_no)
        from theme_counts tc2 join week_units wu on wu.week_no = tc2.week_no
        where tc2.code_id = outer_themes.code_id and tc2.week_no between 1 and 5
      )
    ) order by code_id)
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
      'intro_poll_n',       (select value::int from series_config where key = 'intro_poll_n'),
      'attendance_retention', (
        select round(100.0 * (select attended from weekly where week_no = 5)
                     / (select attended from weekly where week_no = 1))::int
      )
    ) from kpi
  )
);
$$;

revoke execute on function dashboard_metrics() from public, anon;
grant  execute on function dashboard_metrics() to authenticated, dashboard_reader;

-- =======================================================================
-- 0002_pseudonymise.sql — split the identity bridge (GDPR Art. 4(5) / 25)
--
-- Goal: the analysis DB (which backs the public dashboard) holds only the
-- opaque participant_id pseudonym + engagement facts + free-text content.
-- All DIRECT identifiers (names, emails, organisations, IPs, raw handles,
-- and the alias resolution bridge) move into a `private` schema that:
--   • PostgREST never exposes (it only serves `public`), and
--   • anon / authenticated have no USAGE on.
--
-- participant_id stays everywhere, so new Qualtrics / certificate data can
-- still be linked: resolve the incoming email against private.participant_alias
-- to get participant_id, then load only (participant_id, fact) into public.
--
-- NOTE: this is PSEUDONYMISATION, not full anonymisation. Free-text columns
-- (chat_message.message_text, commons_contribution.body, survey_answer.answer_text)
-- are retained as the qualitative-analysis substrate and may contain personal
-- data; they stay behind the same access controls and are never exposed by the
-- dashboard (which serves aggregates only).
--
-- Reversible: all identity data is preserved in `private`; re-running the
-- loader from the SQLite source also restores it.
-- =======================================================================

-- ── 1. Private schema, locked to the API roles ────────────────────────
create schema if not exists private;
revoke all on schema private from anon, authenticated;
revoke usage on schema private from anon, authenticated;
-- (service_role / postgres retain access; PostgREST does not expose `private`)

-- ── 2. participant identity → private ─────────────────────────────────
create table if not exists private.participant_identity (
  participant_id text primary key references public.participant(participant_id),
  canonical_name text,
  first_name     text,
  last_name      text,
  primary_email  text,
  organization   text,
  job_title      text,
  notes          text
);

insert into private.participant_identity
  (participant_id, canonical_name, first_name, last_name, primary_email, organization, job_title, notes)
select participant_id, canonical_name, first_name, last_name, primary_email, organization, job_title, notes
from public.participant
on conflict (participant_id) do nothing;

-- strip the identifiers from the public table (keep id, country, role, flags)
alter table public.participant drop column if exists canonical_name;
alter table public.participant drop column if exists first_name;
alter table public.participant drop column if exists last_name;
alter table public.participant drop column if exists primary_email;
alter table public.participant drop column if exists organization;
alter table public.participant drop column if exists job_title;
alter table public.participant drop column if exists notes;

-- ── 3. the alias bridge → private (whole table is identity resolution) ─
create table if not exists private.participant_alias (like public.participant_alias including all);
insert into private.participant_alias overriding system value
  select * from public.participant_alias
  on conflict do nothing;
drop table if exists public.participant_alias;

-- ── 4. survey response identifiers → private ──────────────────────────
create table if not exists private.survey_response_pii (
  response_id          int8 primary key references public.survey_response(response_id),
  recipient_email      text,
  recipient_first_name text,
  recipient_last_name  text,
  raw_name_inst        text,
  ip_address           text
);

insert into private.survey_response_pii
  (response_id, recipient_email, recipient_first_name, recipient_last_name, raw_name_inst, ip_address)
select response_id, recipient_email, recipient_first_name, recipient_last_name, raw_name_inst, ip_address
from public.survey_response
on conflict (response_id) do nothing;

alter table public.survey_response drop column if exists recipient_email;
alter table public.survey_response drop column if exists recipient_first_name;
alter table public.survey_response drop column if exists recipient_last_name;
alter table public.survey_response drop column if exists raw_name_inst;
alter table public.survey_response drop column if exists ip_address;

-- ── 5. chat display names → private (raw_display_name is a real name) ──
-- message_text stays in public (analysis substrate); the author's display
-- name is a direct identifier and is not needed by any view, so relocate it.
create table if not exists private.chat_author (
  message_id       int8 primary key references public.chat_message(message_id),
  raw_display_name text
);

insert into private.chat_author (message_id, raw_display_name)
select message_id, raw_display_name from public.chat_message
on conflict (message_id) do nothing;

alter table public.chat_message alter column raw_display_name drop not null;
update public.chat_message set raw_display_name = null;

-- ── 6. re-assert defense-in-depth grants on the new private objects ───
revoke all on all tables in schema private from anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;

-- ── 7. refresh views that referenced moved columns ────────────────────
-- v_text_unit / v_engagement_per_user_week / dashboard_metrics() use only
-- participant_id, message_text, body, answer_text, is_facilitator — none of
-- the moved identifier columns — so no view changes are required.
-- (verified post-migration: dashboard_metrics() returns identical figures.)

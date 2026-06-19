-- =======================================================================
-- 0003_least_privilege_role.sql — execute-only role for the Worker
--
-- The Cloudflare Worker connects (via Hyperdrive) as `dashboard_reader`
-- instead of service_role. This role can ONLY execute dashboard_metrics();
-- it has no table access and no `private` schema access. If the Worker's
-- DB credential ever leaks, the blast radius is a single aggregate function
-- — no participant rows, no emails, no names, no IPs.
--
-- After applying, set the role's password and (re)create the Hyperdrive
-- config with it — see README "Least-privilege Worker role".
--   ALTER ROLE dashboard_reader LOGIN PASSWORD '<strong-random>';
-- =======================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dashboard_reader') then
    -- noinherit: never picks up privileges from roles it's a member of
    create role dashboard_reader nologin noinherit;
  end if;
end $$;

-- PostgREST path: let the API authenticator switch into it (harmless if unused)
grant dashboard_reader to authenticator;

-- The ONLY things it may do: reach the schema and run the aggregate function
grant usage   on schema public to dashboard_reader;
grant execute on function public.dashboard_metrics() to dashboard_reader;

-- Belt and braces: no table access anywhere, no private schema
revoke all on all tables in schema public  from dashboard_reader;
revoke all on all tables in schema private from dashboard_reader;
revoke usage on schema private from dashboard_reader;

-- Direct-connection path (Hyperdrive): make it a LOGIN role.
-- Password is set out-of-band (not stored in this migration):
--   ALTER ROLE dashboard_reader LOGIN PASSWORD '<strong-random>';
alter role dashboard_reader login;

-- Verify (run manually):
--   select has_function_privilege('dashboard_reader','public.dashboard_metrics()','execute'); -- t
--   select has_table_privilege('dashboard_reader','public.participant','select');             -- f
--   select has_schema_privilege('dashboard_reader','private','usage');                        -- f

-- Re-enable RLS on port_usage_events (Opsy critical, opened 2026-06-21 06:00 UTC).
--
-- Root cause: the blanket lockdown (20260612_enable_rls_all_tables.sql) ran on
-- 2026-06-12 and covered the tables that existed then. port_usage_events was
-- created 2026-06-21 (20260621_port_usage_events.sql) WITHOUT enabling RLS, so
-- it sat publicly readable/writable via PostgREST — anon holds default grants
-- and the publishable key ships in the public the-weave tool. This is the same
-- failure mode as the 2026-06-12 incident, just one drifted table.
--
-- Safe by construction: port_usage_events is written and read ONLY through the
-- service-role client (port/lib/supabase/client.ts -> SUPABASE_SECRET_KEY, which
-- bypasses RLS). Default-deny (RLS on, no policies) leaves the analytics page
-- and the /api/analytics/pageview writer working; nothing public should read it,
-- so no anon policy is granted.

ALTER TABLE public.port_usage_events ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: re-run the idempotent lockdown sweep so any *other*
-- public table that has since drifted RLS-off is closed in the same pass.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- Durable fix for the recurrence: auto-enable RLS on every newly-created public
-- table via a DDL event trigger, so a future migration that forgets it can't
-- reopen this hole. New tables still get NO policies by default (default-deny);
-- granting any anon/authenticated access remains an explicit, deliberate step.
CREATE OR REPLACE FUNCTION public.force_rls_on_new_tables()
RETURNS event_trigger
LANGUAGE plpgsql AS $$
DECLARE obj record;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END $$;

DROP EVENT TRIGGER IF EXISTS force_rls_on_new_tables_trg;
CREATE EVENT TRIGGER force_rls_on_new_tables_trg
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.force_rls_on_new_tables();

-- Close the wv-booking RLS exposure (Supabase security email, Opsy critical
-- 2026-06-23: "RLS disabled on tables in two projects"). wv-port-pilot was
-- locked down 2026-06-12 + guarded by a force-RLS event trigger 2026-06-22;
-- wv-booking never had RLS enabled at all (0001/0002 create tables without it),
-- so every booking table — names, emails, scheduling PII — was readable and
-- writable via PostgREST with the publishable anon key.
--
-- Safe by construction: the entire booking flow is server-side. Every route
-- under site/app/api/booking/* and /api/book-playdate goes through
-- site/lib/booking/supabase.ts, which uses SUPABASE_SERVICE_ROLE_KEY (bypasses
-- RLS). There is NO direct browser/anon access to wv-booking, and no public
-- tool here (unlike the-weave on wv-port-pilot), so default-deny needs no anon
-- policies. Public booking continues to work unchanged.

-- 1) Enable RLS on every public table currently missing it.
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

-- 2) Durable safeguard: auto-enable RLS on every newly-created public table,
-- so a future booking migration that forgets it can't reopen the hole. Mirrors
-- force_rls_on_new_tables_trg on wv-port-pilot. New tables get NO policies by
-- default (default-deny); granting anon access stays an explicit, deliberate step.
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

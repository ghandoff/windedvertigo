-- Close the wv-port-pilot RLS exposure (Opsy incident, tier-4 audit 2026-06-12).
--
-- Context: anon + authenticated hold full default grants on every public
-- table, and the project's publishable key is embedded by design in the
-- public the-weave tool (site/public/tools/the-weave/index.html, live since
-- 2026-06-07). 97 tables had RLS disabled — meaning the whole CRM was
-- publicly read/writable via PostgREST for ~5 days.
--
-- Fix: enable RLS on every public table (default-deny for anon/authenticated;
-- the port app is unaffected — it uses the service-role key which bypasses
-- RLS), then grant the-weave's three tables the narrow anon access the tool
-- actually uses. Tighten the weave policies later if sessions need isolation.

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

-- the-weave (public workshop tool): select+insert on participants/responses,
-- select+insert+update on sessions — exactly the verbs in the tool.
CREATE POLICY weave_participants_anon_select ON public.weave_participants FOR SELECT TO anon USING (true);
CREATE POLICY weave_participants_anon_insert ON public.weave_participants FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY weave_responses_anon_select ON public.weave_responses FOR SELECT TO anon USING (true);
CREATE POLICY weave_responses_anon_insert ON public.weave_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY weave_sessions_anon_select ON public.weave_sessions FOR SELECT TO anon USING (true);
CREATE POLICY weave_sessions_anon_insert ON public.weave_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY weave_sessions_anon_update ON public.weave_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);

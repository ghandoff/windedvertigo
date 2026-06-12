-- Opsy phase 2: cron failure tracking + RLS audit RPC
-- (slack alerting, email capture, and tier 2-4 checks are code-only; the
-- opsy_email_captures and opsy_auto_fixes tables shipped in phase 1)

-- cron run failures (successes are not recorded — volume isn't worth it yet).
-- written by /api/opsy/cron-failure when lib/scheduled.ts dispatch sees a
-- non-2xx or a fetch error; retried/retry_ok record the one-shot auto-retry.
CREATE TABLE IF NOT EXISTS public.opsy_cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT false,
  status_code int,
  error text,
  retried boolean NOT NULL DEFAULT false,
  retry_ok boolean
);
CREATE INDEX opsy_cron_runs_path_fired_idx ON public.opsy_cron_runs (path, fired_at DESC);
CREATE INDEX opsy_cron_runs_fired_idx ON public.opsy_cron_runs (fired_at DESC);

ALTER TABLE public.opsy_cron_runs ENABLE ROW LEVEL SECURITY;

-- RLS audit for the tier-4 security check. PostgREST can't read pg_catalog,
-- so expose a SECURITY DEFINER function callable via supabase.rpc().
-- Service-role only: RLS-less surface is sensitive, so revoke from anon/authed.
CREATE OR REPLACE FUNCTION public.opsy_rls_report()
RETURNS TABLE (table_name text, rls_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.relname::text, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.opsy_rls_report() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.opsy_rls_report() FROM anon;
REVOKE ALL ON FUNCTION public.opsy_rls_report() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.opsy_rls_report() TO service_role;

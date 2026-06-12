-- Opsy: operations + systems intelligence (fourth agent)
-- Schema per docs/opsy/implementation-prompt.md §2, plus the decisions/memory
-- pair every agent has (cmo/pam/carl pattern) so briefing/memory/decisions
-- endpoints work. All tables RLS-enabled with no policies — only the
-- service-role key (server-side API routes) can touch them.

-- incidents log
CREATE TABLE IF NOT EXISTS public.opsy_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  symptoms TEXT NOT NULL,
  cause TEXT,
  remediation TEXT,
  auto_fixed BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'monitoring')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  related_incidents UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX opsy_incidents_service_idx ON public.opsy_incidents (service);
CREATE INDEX opsy_incidents_status_idx ON public.opsy_incidents (status);
CREATE INDEX opsy_incidents_severity_idx ON public.opsy_incidents (severity);
CREATE INDEX opsy_incidents_opened_idx ON public.opsy_incidents (opened_at DESC);

-- health check results
CREATE TABLE IF NOT EXISTS public.opsy_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  response_time_ms INT,
  error_rate NUMERIC(5,2),
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX opsy_health_checks_service_checked_idx ON public.opsy_health_checks (service, checked_at DESC);
CREATE INDEX opsy_health_checks_checked_idx ON public.opsy_health_checks (checked_at DESC);

-- auto-fix history
CREATE TABLE IF NOT EXISTS public.opsy_auto_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.opsy_incidents(id),
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'partial')),
  details JSONB DEFAULT '{}',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX opsy_auto_fixes_executed_idx ON public.opsy_auto_fixes (executed_at DESC);

-- learned patterns
CREATE TABLE IF NOT EXISTS public.opsy_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  services TEXT[] NOT NULL,
  occurrence_count INT DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT now(),
  recommendation TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX opsy_patterns_type_idx ON public.opsy_patterns (pattern_type);

-- email notifications captured (table ships in phase 1; scanning is phase 2)
CREATE TABLE IF NOT EXISTS public.opsy_email_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL UNIQUE,
  from_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  service TEXT,
  severity TEXT CHECK (severity IN ('critical', 'warning', 'info')),
  summary TEXT,
  action_taken TEXT,
  incident_id UUID REFERENCES public.opsy_incidents(id),
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- decisions: append-only log of every Opsy conversation (cmo/pam/carl pattern)
CREATE TABLE IF NOT EXISTS public.opsy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  session_type text DEFAULT 'cowork',
  summary text NOT NULL,
  decisions jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  raw_context text
);
CREATE INDEX opsy_decisions_who_idx ON public.opsy_decisions (who);
CREATE INDEX opsy_decisions_created_idx ON public.opsy_decisions (created_at DESC);
CREATE INDEX opsy_decisions_tags_idx ON public.opsy_decisions USING gin (tags);

-- memory: key-value working state (cmo/pam/carl pattern)
CREATE TABLE IF NOT EXISTS public.opsy_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);

ALTER TABLE public.opsy_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_auto_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_email_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_memory ENABLE ROW LEVEL SECURITY;

-- seed working state
INSERT INTO public.opsy_memory (key, value, updated_by) VALUES
  ('tier1-services',     'wv-site (windedvertigo.com), harbour hub (windedvertigo.com/harbour), nordic (nordic.windedvertigo.com), port (port.windedvertigo.com), creaseworks (windedvertigo.com/harbour/creaseworks)', 'garrett'),
  ('monitoring-status',  'phase 1 — tier 1 health checks every 5 minutes via the port worker''s */5 cron trigger. tiers 2-4, slack alerting, and email capture land in phase 2.', 'garrett'),
  ('posture-version',    'docs/opsy/posture.md, established 2026-06-11', 'garrett')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

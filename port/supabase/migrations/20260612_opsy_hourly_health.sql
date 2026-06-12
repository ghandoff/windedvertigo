-- Hourly health rollup for the /ops dashboard sparklines (phase 3).
-- Aggregating in SQL keeps the 7-day window (~20k raw check rows) out of the
-- API payload — the function returns ~168 buckets per service instead.
CREATE OR REPLACE FUNCTION public.opsy_hourly_health(hours_back int DEFAULT 168)
RETURNS TABLE (service text, bucket timestamptz, p95_ms int, worst text)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT
    service,
    date_trunc('hour', checked_at) AS bucket,
    (percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms))::int AS p95_ms,
    CASE
      WHEN bool_or(status = 'red') THEN 'red'
      WHEN bool_or(status = 'amber') THEN 'amber'
      ELSE 'green'
    END AS worst
  FROM public.opsy_health_checks
  WHERE checked_at > now() - make_interval(hours => hours_back)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.opsy_hourly_health(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.opsy_hourly_health(int) FROM anon;
REVOKE ALL ON FUNCTION public.opsy_hourly_health(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.opsy_hourly_health(int) TO service_role;

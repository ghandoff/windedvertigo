#!/usr/bin/env bash
# security_probe.sh — verify the PPCS dashboard's data boundary holds.
#
# Run after every deploy and on a schedule. Exits non-zero (and prints FAIL)
# on any regression, so it can drive an alert.
#
# What it checks:
#   1. anon key CANNOT read base tables via PostgREST  (expect permission denied)
#   2. anon key CANNOT call dashboard_metrics() RPC     (expect permission denied)
#   3. the `private` schema is NOT exposed by the API
#   4. the served browser bundle leaks no secret/PII     (no JWT, no project ref, no email)
#   5. /api/metrics DOES return valid aggregate JSON      (positive: dashboard works)
#
# The anon key below is public by design (it is meant to ship in clients);
# it is useless without a row-level grant, which is exactly what we test.

set -uo pipefail

WORKER_URL="https://wv-ppcs-impact.windedvertigo.workers.dev"
SUPA_URL="https://txuchtssjgccsaezsptz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4dWNodHNzamdjY3NhZXpzcHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDg2MTksImV4cCI6MjA5NjEyNDYxOX0.uKWmChMj7wQug3w2nz3Wk2FT0JOyNUtUYE-x7aQnvdY"

fails=0
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; fails=$((fails+1)); }

hdr=(-H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")

echo "PPCS dashboard security probe — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1 + 2 + 3: anon must be denied on (or not even see) every sensitive surface.
# participant_alias now lives in `private`, so the API should report it missing —
# that's the strongest possible result.
for tbl in participant participant_alias chat_message survey_response; do
  body=$(curl -s "$SUPA_URL/rest/v1/$tbl?select=*&limit=1" "${hdr[@]}")
  if echo "$body" | grep -q "permission denied"; then
    pass "anon denied on table: $tbl"
  elif echo "$body" | grep -qi "Could not find\|PGRST205"; then
    pass "table not exposed to API: $tbl (moved to private / dropped)"
  elif [ "$body" = "[]" ]; then
    echo "  WARN  anon got [] on $tbl (RLS holding, but table grant still present)"
  else
    fail "anon RECEIVED DATA from $tbl → $(echo "$body" | head -c 120)"
  fi
done

rpc=$(curl -s -X POST "$SUPA_URL/rest/v1/rpc/dashboard_metrics" "${hdr[@]}" -H "Content-Type: application/json" -d '{}')
echo "$rpc" | grep -q "permission denied" \
  && pass "anon denied on dashboard_metrics() RPC" \
  || fail "anon could call RPC → $(echo "$rpc" | head -c 120)"

priv=$(curl -s "$SUPA_URL/rest/v1/participant_identity?select=primary_email&limit=1" "${hdr[@]}" -H "Accept-Profile: private")
echo "$priv" | grep -qi "Invalid schema: private\|Could not find" \
  && pass "private schema not exposed by API" \
  || fail "private schema reachable → $(echo "$priv" | head -c 120)"

# 4: served bundle leaks nothing
bundle=$(curl -s "$WORKER_URL/")
leaks=0
echo "$bundle" | grep -q "txuchtss"               && { fail "bundle leaks project ref"; leaks=1; }
echo "$bundle" | grep -qE "eyJ|service_role"       && { fail "bundle leaks a JWT/service key"; leaks=1; }
echo "$bundle" | grep -qiE "[a-z0-9._]+@[a-z0-9.]+\.[a-z]{2,}" && { fail "bundle contains an email address"; leaks=1; }
[ "$leaks" -eq 0 ] && pass "served bundle has no secret/PII leakage"

# 5: dashboard actually works (aggregate JSON present, no row-level keys)
metrics=$(curl -s "$WORKER_URL/api/metrics?cb=$(date +%s)")
if echo "$metrics" | grep -q '"unique_registrants"'; then
  # and make sure NO identifying field ever appears in the payload
  if echo "$metrics" | grep -qiE "email|primary_email|canonical_name|raw_display_name|ip_address"; then
    fail "/api/metrics payload contains an identifying field"
  else
    pass "/api/metrics returns aggregates only (no PII)"
  fi
else
  fail "/api/metrics did not return expected aggregates → $(echo "$metrics" | head -c 120)"
fi

echo ""
if [ "$fails" -eq 0 ]; then
  echo "RESULT: ALL CHECKS PASSED ✓"
  exit 0
else
  echo "RESULT: $fails CHECK(S) FAILED ✗ — investigate immediately"
  exit 1
fi

#!/usr/bin/env bash
# Watch all pursuing RFPs until they reach a terminal proposal_status,
# then send a Slack DM summary to garrett. Tails wv-port-jobs error logs
# for any failures along the way.
#
# Usage: bash scripts/watch-rfp-regen.sh

set -uo pipefail

cd "$(dirname "$0")/.."

POLL_INTERVAL=30
MAX_MINUTES=20
START_TS=$(date +%s)
MAX_TS=$((START_TS + MAX_MINUTES * 60))

# Snapshot the IDs we are watching from the bulk-regen response
TARGETS=(
  "345e4ee7-4ba4-8191-9feb-e20a85c8150b"   # Oxfam Denmark
  "b63b92a4-c3dd-4d26-8fd8-ed556d0f7531"   # UNICEF Global LTAS
  "34ce4ee7-4ba4-81aa-b2e6-d6874e99e674"   # Changemakers in Family Planning
  "350e4ee7-4ba4-8130-bec0-f87e5ad97d1f"   # Evaluation Consultant
)

mkdir -p /tmp
LOG_FILE="/tmp/watch-rfp-regen-$(date +%Y%m%d-%H%M%S).log"
echo "[$(date)] starting watch · log: $LOG_FILE" | tee -a "$LOG_FILE"

# Tail wv-port-jobs error logs in background
(cd port-jobs && npx wrangler tail wv-port-jobs --format pretty --status error >> "$LOG_FILE" 2>&1) &
TAIL_PID=$!
trap 'kill $TAIL_PID 2>/dev/null || true' EXIT

while true; do
  NOW=$(date +%s)
  if (( NOW > MAX_TS )); then
    echo "[$(date)] timeout after $MAX_MINUTES min — exiting watch" | tee -a "$LOG_FILE"
    break
  fi

  # Snapshot current state
  STATE_JSON=$(supabase db query --linked 2>/dev/null <<EOF
SELECT
  notion_page_id,
  opportunity_name,
  proposal_status,
  proposal_step,
  proposal_completed_at::text AS completed,
  EXTRACT(EPOCH FROM (NOW() - proposal_started_at))/60 AS minutes_running
FROM rfp_opportunities
WHERE notion_page_id IN ('345e4ee7-4ba4-8191-9feb-e20a85c8150b', 'b63b92a4-c3dd-4d26-8fd8-ed556d0f7531', '34ce4ee7-4ba4-81aa-b2e6-d6874e99e674', '350e4ee7-4ba4-8130-bec0-f87e5ad97d1f');
EOF
)

  echo "---- $(date) ----" | tee -a "$LOG_FILE"
  echo "$STATE_JSON" | grep -E '"opportunity_name"|"proposal_status"|"proposal_step"' | tee -a "$LOG_FILE"

  # Count how many are still in non-terminal states (queued or generating)
  ACTIVE=$(echo "$STATE_JSON" | grep -c '"proposal_status": "generating"\|"proposal_status": "queued"' || true)

  if (( ACTIVE == 0 )); then
    echo "[$(date)] all 4 RFPs reached terminal status — assembling summary" | tee -a "$LOG_FILE"
    break
  fi

  echo "[$(date)] $ACTIVE still in flight — sleeping ${POLL_INTERVAL}s" | tee -a "$LOG_FILE"
  sleep "$POLL_INTERVAL"
done

# Build summary
SUMMARY=$(supabase db query --linked 2>/dev/null <<EOF
SELECT
  opportunity_name,
  proposal_status,
  COALESCE(proposal_step, 'none') AS step,
  proposal_draft_url
FROM rfp_opportunities
WHERE notion_page_id IN ('345e4ee7-4ba4-8191-9feb-e20a85c8150b', 'b63b92a4-c3dd-4d26-8fd8-ed556d0f7531', '34ce4ee7-4ba4-81aa-b2e6-d6874e99e674', '350e4ee7-4ba4-8130-bec0-f87e5ad97d1f')
ORDER BY due_date ASC;
EOF
)

# Format Slack message
SLACK_MSG="🎯 *RFP Bulk Regenerate — Final Status*\n\n"
SLACK_MSG+="$(echo "$SUMMARY" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
# Strip the leading 'Initialising login role' if present
m = re.search(r'\{.*\}', raw, re.DOTALL)
if not m:
  print('(could not parse summary — see log)')
  sys.exit(0)
data = json.loads(m.group(0))
lines = []
for r in data.get('rows', []):
    name = r.get('opportunity_name', '?')
    status = r.get('proposal_status', '?')
    step = r.get('step', '')
    url = r.get('proposal_draft_url') or ''
    icon = '✅' if status == 'ready-for-review' else ('❌' if status == 'failed' else '⏳')
    line = f'{icon} *{name}* — {status}'
    if status == 'failed' and step:
        line += f' (`{step}`)'
    if url:
        line += f' <{url}|→ draft>'
    lines.append(line)
print('\n'.join(lines))
")"

SLACK_MSG+="\n\n_See watch log: \`$LOG_FILE\`_"

# Try to send via the wv-claw webhook (in port .env.local) or SLACK_WEBHOOK_URL
WEBHOOK=$(grep -E '^WV_CLAW_WEBHOOK|^SLACK_WEBHOOK_URL' port/.env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -n "$WEBHOOK" ]; then
  curl -s -X POST -H 'Content-Type: application/json' \
    -d "$(jq -n --arg t "$SLACK_MSG" '{text:$t}')" \
    "$WEBHOOK" > /dev/null
  echo "[$(date)] sent slack DM" | tee -a "$LOG_FILE"
else
  echo "[$(date)] no webhook found — printing summary locally:" | tee -a "$LOG_FILE"
  echo -e "$SLACK_MSG" | tee -a "$LOG_FILE"
fi

echo "[$(date)] watch complete" | tee -a "$LOG_FILE"

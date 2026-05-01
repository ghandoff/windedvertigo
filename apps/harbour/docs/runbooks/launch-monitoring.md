# Harbour launch monitoring runbook

> Single document Claude or Garrett can re-run cold during launch.
> Per-symptom decision trees + saved monitoring queries.

## When something breaks: triage tree

```
Public 5xx on /harbour or any harbour app?
├─ Smoke worker red? → check `wv-launch-smoke` Slack alert (if A3 wired)
├─ Single Worker? → `wrangler tail wv-harbour-<app>`
└─ All Workers? → CF dashboard zone health → status.cloudflare.com

Magic-link signin not arriving?
├─ Resend bounce? → Resend dashboard → Logs → filter by recipient
├─ All recipients? → check Resend domain status (DKIM/SPF/DMARC)
└─ Selective domain (gmail/yahoo)? → likely SPF/DMARC alignment issue,
   see C2 findings below

Pool A SSO mismatch (signed in to one app, not another)?
├─ AUTH_SECRET mismatch → all 4 Pool A apps must share the same secret
├─ Cookie domain misconfiguration → check authjs.session-token cookie
│  is on .windedvertigo.com (not host-scoped)
└─ Auth.js v5 nonce/csrf rotation → re-authenticate user

CF API token expired (wrangler errors with "Failed to fetch auth token")?
└─ Recreate token in CF dashboard, write to ~/.cf-token, redeploy
```

## Saved monitoring URLs

### Cloudflare

- **Workers dashboard**: <https://dash.cloudflare.com/097c92553b268f8360b74f625f6d980a/workers/services>
- **Zone health (windedvertigo.com)**: <https://dash.cloudflare.com/097c92553b268f8360b74f625f6d980a/windedvertigo.com>
- **WAF / Bot Fight Mode**: <https://dash.cloudflare.com/097c92553b268f8360b74f625f6d980a/windedvertigo.com/security/waf>
- **R2 buckets**: <https://dash.cloudflare.com/097c92553b268f8360b74f625f6d980a/r2/default/buckets>
- **API tokens**: <https://dash.cloudflare.com/profile/api-tokens>

### Vercel (creaseworks, vault, port, ops)

- **Team dashboard**: <https://vercel.com/winded-vertigo>
- **Function logs (creaseworks)**: <https://vercel.com/winded-vertigo/wv-creaseworks/logs>
- **Function logs (vault)**: <https://vercel.com/winded-vertigo/wv-vertigo-vault/logs>
- **Function logs (port)**: <https://vercel.com/winded-vertigo/wv-port/logs>

### Other

- **Resend dashboard**: <https://resend.com/dashboard>
- **Resend domain status (windedvertigo.com)**: <https://resend.com/domains>
- **Neon Postgres dashboard**: <https://console.neon.tech/>

## `wrangler tail` filter strings

Watch a Worker's live logs:

```bash
export CLOUDFLARE_API_TOKEN=$(cat ~/.cf-token)

# Generic — tail one Worker
npx wrangler tail wv-harbour-harbour

# Filter to 5xx responses only
npx wrangler tail wv-harbour-harbour --status error

# Filter to auth callback requests
npx wrangler tail wv-harbour-harbour --search "/api/auth/callback"

# Filter to a specific user (if you know their email)
npx wrangler tail wv-harbour-harbour --search "user@example.com"

# Sample only 1 in 10 (high traffic)
npx wrangler tail wv-harbour-harbour --sampling-rate 0.1
```

## Smoke worker inspection

The `wv-launch-smoke` Worker writes the latest run state to KV. Read it:

```bash
export CLOUDFLARE_API_TOKEN=$(cat ~/.cf-token)
npx wrangler kv key get --namespace-id=b67fcfef7da04135999738370da62c8f latest | jq
```

KV value shape (per `apps/launch-smoke/src/index.ts`):
```json
{
  "ranAt": "2026-04-26T20:00:00.000Z",
  "totalMs": 18234,
  "total": 40,
  "green": 39,
  "slow": 0,
  "red": 1,
  "results": [
    { "label": "...", "status": 504, "red": true, "slow": false, "reasons": ["..."] }
  ]
}
```

The fetch handler also serves the latest run as JSON:
```bash
curl https://wv-launch-smoke.windedvertigo.workers.dev | jq
```

The Worker only runs probes on its cron trigger (`*/30 * * * *`), not
on fetch. To force an immediate run for testing, use `wrangler` to
invoke the scheduled trigger:
```bash
npx wrangler dev --test-scheduled --name wv-launch-smoke
# then in another shell:
curl "http://localhost:8787/__scheduled?cron=*/30+*+*+*+*"
```

## Resend deliverability

```bash
# Webhook-based — install once via Resend dashboard
# https://resend.com/webhooks → add bounce + complaint handlers
# pointing at port's /api/webhooks/resend route (not yet built)

# DNS health check
dig +short TXT _dmarc.windedvertigo.com
dig +short TXT windedvertigo.com  # SPF
dig +short TXT resend._domainkey.windedvertigo.com  # DKIM

# Live as of 2026-04-26:
# DMARC: v=DMARC1; p=none; rua=mailto:dmarc@windedvertigo.com; ruf=mailto:dmarc@windedvertigo.com; pct=100; aspf=r; adkim=r
# SPF:   v=spf1 +a +mx include:_<dnssmarthost-token>.spf.dnssmarthost.net include:_spf.resend.com ~all
# DKIM:  resend._domainkey returns valid key ✓
```

## C2 status — DNS gaps closed 2026-04-26

| Record | Status | Notes |
|---|---|---|
| SPF | ✅ `include:_spf.resend.com` added | shipped autonomously in the prior session; `dig +short TXT windedvertigo.com` confirms |
| DMARC | ✅ `p=none; rua=...; pct=100; aspf=r; adkim=r` published | `dmarc@windedvertigo.com` alias on garrett@ also live (set up out-of-band). First aggregate reports expected from Google/Yahoo within 24–48h |
| DKIM | ✅ resend selector valid | unchanged, healthy |

DNS changes happen at Cloudflare zone `3b70c2ddcf9976faccb01d37ccf2e1ee`. Updates propagate in ~5 min.

### End-to-end magic-link verification

After any DNS change touching SPF / DKIM / DMARC, run:

```bash
node scripts/trigger-magic-link.mjs --to=<address-you-control-on-gmail>
# then in gmail: open the message → ⋮ → "show original"
# → copy every "Authentication-Results:" line and paste back to claude
```

Parse the header for `spf=`, `dkim=`, `dmarc=`. DKIM-pass + DMARC-pass is the bar; SPF-pass alignment requires Resend's custom return-path CNAME (`bounces.windedvertigo.com → bounces.resend.com`), not yet wired — flagged as conditional follow-up if launch traffic surfaces deliverability issues.

### C1 deliverability seed (~50 messages across 4 ISPs)

Pre-launch confidence-builder. Sends 50 transactional emails (NOT magic-links — burner accounts shouldn't spawn user rows) across gmail/yahoo/icloud/outlook, then watches Resend bounce + complaint events for 48h.

```bash
# 1. populate scripts/c1-recipients.local.json with ≥10 addresses per provider
# 2. source ~/.config/wv-agent/env.local  (RESEND_API_KEY)
node scripts/c1-seed-send.mjs --campaign=c1-seed-2026-04-26
node scripts/c1-seed-watch.mjs --campaign=c1-seed-2026-04-26   # 48h polling
```

Thresholds: ≥98% delivered overall, ≥95% per-provider, 0% complaint, all 4 providers represented. Slack red-alert via `WV_CLAW_WEBHOOK` when bounce >2% or complaint >0.1%.

## Auth.js debug toggle

Auth.js v5 emits structured warnings via the `[auth]` prefix. Enable
debug mode by setting `AUTH_DEBUG=true` on a specific Worker:

```bash
echo "true" | npx wrangler secret put AUTH_DEBUG --name wv-harbour-<app>
# Then redeploy that app
# Remember to remove this after — it's verbose
echo "false" | npx wrangler secret put AUTH_DEBUG --name wv-harbour-<app>
```

## Rollback procedures

### Single Worker rollback

```bash
export CLOUDFLARE_API_TOKEN=$(cat ~/.cf-token)
cd apps/<app>
npx wrangler deployments list  # find the prior version
npx wrangler rollback <version-id>
```

### Vercel rollback

```bash
cd <project-dir>
vercel rollback <deployment-url>
# or via dashboard: https://vercel.com/winded-vertigo/<project>/deployments
```

### Pool A SSO regression (worst case — users logged out)

Symptom: users on creaseworks suddenly need to re-sign-in.
Cause: AUTH_SECRET drift across the 4 Pool A Workers.

```bash
# Get the canonical AUTH_SECRET — the one that's been working
# (depth-chart's secret is the longest-lived; if all drift, regenerate
# and update all 4 simultaneously)

# Verify each Worker has a secret named AUTH_SECRET
for app in harbour depth-chart; do
  echo "=== $app ==="
  npx wrangler secret list --name wv-harbour-$app | grep AUTH_SECRET
done

# To resync — you need the original secret value, which is only on
# Vercel for creaseworks/vault. Pull it:
cd apps/creaseworks && vercel env pull .env.production-tmp --environment=production
grep AUTH_SECRET .env.production-tmp | cut -d= -f2-
# Use that value to update both CF Workers
rm .env.production-tmp
```

## Postgres connection pool

Neon dashboard → project → Operations → connection counts.

Healthy: p95 connections < 60 on Launch tier (max 100 default pooled).
Warning: p95 > 80 → consider Hyperdrive in front for harbour Worker.
Critical: p99 > 95 → upgrade tier or add read-replica.

## Cron health

| Cron | Where | Schedule | Health check |
|---|---|---|---|
| smoke probe | `wv-launch-smoke` Worker | `*/30 * * * *` | KV `LATEST` updated within last 35 min |
| harbour tile sync | `wv-harbour-harbour` admin endpoint | manual via `/api/admin/sync-tiles` | last run logged in CF dashboard |
| creaseworks Notion sync | Vercel cron | daily | check Vercel function log |
| creaseworks digest | Vercel cron | weekly | check Vercel function log |
| port generate-pdfs | Vercel cron | weekly Mon 6am UTC | check port logs |

## Escalation

- **Launch-day** issues: prioritise rollback over diagnosis. Restore
  service, then root-cause from logs.
- **CF zone-level** problems: check status.cloudflare.com. If it's a
  zone outage, no rollback helps.
- **Anthropic / Resend / Stripe outage**: check their status pages
  before assuming our config is broken.

## Last updated

2026-04-26 — initial draft (forward roadmap C4).
Update when adding new Workers, changing crons, or finding new
production-incident patterns.

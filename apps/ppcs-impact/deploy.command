#!/bin/bash
# Deploy wv-ppcs-impact (PPCS 2026 Engagement Dashboard) to Cloudflare.
# Updates the Worker code + static assets only. Does NOT touch the D1 data.
# Rollback if anything looks wrong: see backup-2026-06-16/RESTORE.md
set -e
cd "$(dirname "$0")"

echo "=== Step 1: Refreshing Cloudflare auth ==="
echo "A browser tab will open — approve the Wrangler consent form."
echo ""
npx wrangler login

echo ""
echo "=== Step 2: Deploying wv-ppcs-impact ==="
echo "Working directory: $(pwd)"
npx wrangler deploy

echo ""
echo "=== Deploy complete — verifying live ==="
sleep 3
curl -s -o /dev/null -w "page:   HTTP %{http_code}\n" https://windedvertigo.com/portfolio/ppcs-2026-impact/
curl -s -o /dev/null -w "metrics: HTTP %{http_code}\n" https://windedvertigo.com/portfolio/ppcs-2026-impact/api/metrics
echo ""
echo "Open: https://windedvertigo.com/portfolio/ppcs-2026-impact/"
echo "(If /api/metrics looks stale, the worker edge-caches it for 600s — wait or purge cache.)"
echo ""
echo "Press any key to close..."
read -n 1

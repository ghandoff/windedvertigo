#!/bin/bash
# Step 1: Login to Cloudflare (refreshes OAuth token)
# Step 2: Deploy the site to Cloudflare Workers
set -e
cd "$(dirname "$0")/site"

echo "=== Step 1: Refreshing Cloudflare auth ==="
echo "A browser tab will open — approve the Wrangler consent form."
echo ""
npx wrangler login

echo ""
echo "=== Step 2: Deploying wv-site to Cloudflare Workers ==="
echo "Working directory: $(pwd)"
export CLOUDFLARE_ACCOUNT_ID=097c92553b268f8360b74f625f6d980a
export OPEN_NEXT_DEPLOY=true
npx wrangler deploy

echo ""
echo "=== Deploy complete! ==="
echo "https://windedvertigo.com/tools/ppcs-launch"
echo ""
echo "Press any key to close..."
read -n 1

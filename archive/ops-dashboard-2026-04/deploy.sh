#!/bin/bash
# wv-ops: one-click setup and deploy
# Run with: sh deploy.sh

set -e

echo "→ initializing ops-dashboard repo..."
git init
git add -A
git commit -m "init: winded.vertigo ops command center"

echo "→ connecting to github..."
git remote add origin git@github.com:ghandoff/wv-ops.git
git branch -M main
git push -u origin main

echo "→ deploying to vercel..."
npx vercel link --yes --project=wv-ops
npx vercel deploy --prod --yes

echo ""
echo "✓ done! your ops dashboard is live."
echo "  next: go to vercel.com to set up ops.windedvertigo.com"

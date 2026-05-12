#!/usr/bin/env bash
# Smoke-test all harbour-app production routes.
# Run from anywhere in your windedvertigo clone:
#     bash scripts/smoke-test.sh
#
# Hits each URL via curl, reports HTTP status + flags any leftover Vercel
# headers. Exits non-zero if any URL fails so you can pipe this into CI.

set -euo pipefail

# Auto-find repo root (works from any subdirectory) — not strictly needed
# for the curls, but keeps invocation pattern consistent with ship.sh.
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
green(){ printf '\033[1;32m%s\033[0m' "$*"; }
red()  { printf '\033[1;31m%s\033[0m' "$*"; }
yellow(){ printf '\033[1;33m%s\033[0m' "$*"; }

# ─── targets ────────────────────────────────────────────────────────────────
# Each entry: PATH|LABEL
# Add new harbour apps here as they come online.
paths=(
  "/portfolio/assets/values-auction/|values-auction SPA (portfolio entry)"
  "/harbour/values-auction/|values-auction SPA (harbour entry)"
  "/wordmark.svg|values-auction wordmark proxy"
  "/harbour/cuts-catalogue/|CUTS Catalog (Thursday demo)"
  "/harbour/vertigo-vault/|Vertigo Vault"
  "/harbour/read-the-room/|read-the-room (control — known good)"
  "/harbour/creaseworks/|Creaseworks (control — known good)"
)

# Optional: rubric worker direct (only meaningful once it's deployed)
RUBRIC_URL="https://wv-harbour-rubric-co-builder.windedvertigo.workers.dev/harbour/rubric-co-builder"

bold "Smoke-testing https://windedvertigo.com"
echo ""

ok=0; fail=0
for entry in "${paths[@]}"; do
  IFS='|' read -r path label <<< "$entry"
  url="https://windedvertigo.com$path"

  # Status code (follow redirects)
  status=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 15 "$url" 2>/dev/null || echo "ERR")

  # Headers (for x-vercel-* detection)
  vercel_hdr=$(curl -sSI --max-time 5 "$url" 2>/dev/null | grep -i "^x-vercel" || true)

  case "$status" in
    200|301|302|304)
      if [[ -n "$vercel_hdr" ]]; then
        printf "%s %-50s → %s %s\n" "$(yellow ⚠)" "$label" "$status" "(but Vercel header present!)"
        fail=$((fail+1))
      else
        printf "%s %-50s → %s\n" "$(green ✓)" "$label" "$status"
        ok=$((ok+1))
      fi
      ;;
    *)
      printf "%s %-50s → %s  (%s)\n" "$(red ✗)" "$label" "$status" "$url"
      fail=$((fail+1))
      ;;
  esac
done

# ─── rubric (optional — only if worker exists) ──────────────────────────────
echo ""
bold "Rubric worker (direct)"
rubric_status=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 10 "$RUBRIC_URL" 2>/dev/null || echo "ERR")
case "$rubric_status" in
  200|301|302|304)
    printf "%s wv-harbour-rubric-co-builder direct → %s\n" "$(green ✓)" "$rubric_status"
    ;;
  ERR|"")
    printf "%s wv-harbour-rubric-co-builder direct → unreachable (worker may not exist yet)\n" "$(yellow ⚠)"
    ;;
  *)
    printf "%s wv-harbour-rubric-co-builder direct → %s\n" "$(yellow ⚠)" "$rubric_status"
    ;;
esac

# ─── summary ────────────────────────────────────────────────────────────────
echo ""
bold "Result: $ok pass / $fail fail"
echo ""

if [[ "$fail" -eq 0 ]]; then
  green "✓ all production routes healthy"
  echo ""
  exit 0
else
  red "✗ $fail route(s) need attention — paste this output back to Claude"
  echo ""
  exit 1
fi

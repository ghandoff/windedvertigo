#!/bin/bash
# setup-booking.command
#
# One-time setup for the windedvertigo.com booking system.
# Walks through provisioning, secret-loading, migration, and seeding
# in the correct order. Re-runnable — each step checks before acting.
#
# Usage: double-click this file in Finder, or run from terminal:
#   bash /Users/garrettjaeger/Projects/windedvertigo/setup-booking.command

set -e
cd "$(dirname "$0")"

REPO_ROOT="$(pwd)"
SITE_DIR="$REPO_ROOT/site"
SUPABASE_DIR="$REPO_ROOT/supabase"
SECRETS_FILE="$SITE_DIR/.secrets-do-not-commit/booking.env"

# ── colors ───────────────────────────────────────────────────────
BOLD="\033[1m"
DIM="\033[2m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${BLUE}▸ $1${RESET}"; }
ok() { echo -e "${GREEN}  ✓${RESET} $1"; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $1"; }
err() { echo -e "${RED}  ✗${RESET}  $1"; }
prompt() { echo -e "${BOLD}${YELLOW}❯${RESET} $1"; }
input() { read -p "  $1 " "$2"; }

pause() {
  echo
  read -p "  press enter when done... "
}

confirm() {
  local response
  read -p "  $1 [y/N] " response
  [[ "$response" =~ ^[Yy]$ ]]
}

# ── banner ──────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "═══════════════════════════════════════════════════════════════"
echo "  winded.vertigo · booking system setup"
echo "  graceful-popping-willow"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${RESET}"
echo "this script walks through the one-time provisioning needed to"
echo "stand up the booking system. about 25 minutes total — most of"
echo "it clicking through external services."
echo

# ── 0. preconditions ────────────────────────────────────────────
step "checking prerequisites"

command -v wrangler >/dev/null 2>&1 || { err "wrangler not installed. run: npm i -g wrangler"; exit 1; }
ok "wrangler installed"

command -v gh >/dev/null 2>&1 || { err "gh CLI not installed. run: brew install gh"; exit 1; }
ok "gh CLI installed"

command -v supabase >/dev/null 2>&1 || warn "supabase CLI not found — install with: brew install supabase/tap/supabase (optional, for local dev only)"

[ -f "$SECRETS_FILE" ] || { err "$SECRETS_FILE not found. re-run secret generation."; exit 1; }
ok "local secrets file present"

# ── 1. supabase project ─────────────────────────────────────────
step "step 1 of 6: create the supabase project"

cat <<EOF
  this requires a manual click-through at supabase.com — there's no
  headless API for creating a new project.

  1. go to: ${BOLD}https://supabase.com/dashboard/new${RESET}
  2. project name:   ${BOLD}wv-booking${RESET}
  3. region:         ${BOLD}us-west-1${RESET} (san francisco)
  4. pricing tier:   ${BOLD}free${RESET}
  5. database password: generate a strong one. save it in 1Password.
EOF

if ! confirm "have you created the project?"; then
  warn "stopping. re-run when ready."
  exit 0
fi

cat <<EOF

  now grab the project credentials:
  1. project settings → api keys
  2. copy ${BOLD}Project URL${RESET} (looks like https://abc.supabase.co)
  3. copy ${BOLD}service_role${RESET} key (NOT the anon key — service_role)

EOF

input "paste the Project URL:" SUPABASE_URL
input "paste the service_role key:" SUPABASE_SERVICE_ROLE_KEY

[[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]] && { err "missing values, stopping"; exit 1; }

# stash to local secrets file (never committed)
echo "SUPABASE_URL=$SUPABASE_URL" >> "$SECRETS_FILE"
echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> "$SECRETS_FILE"
ok "supabase creds saved locally"

# ── 2. apply migration ──────────────────────────────────────────
step "step 2 of 6: apply the database migration"

cat <<EOF
  the migration file is at:
    supabase/migrations/0001_booking_init.sql

  paste this into the supabase SQL editor:
    ${BOLD}https://supabase.com/dashboard/project/_/sql/new${RESET}
  (replace _ with your project ref, or pick from the project list)

  then run it. expected output: 'Success. No rows returned'.

EOF

if confirm "open the migration file now?"; then
  open "$SUPABASE_DIR/migrations/0001_booking_init.sql"
fi

if ! confirm "did the migration apply cleanly?"; then
  warn "stopping. fix the migration first."
  exit 0
fi
ok "migration applied"

# ── 3. seed hosts + event types ─────────────────────────────────
step "step 3 of 6: seed hosts and event types"

cd "$SITE_DIR"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" npx tsx scripts/booking-seed-hosts.ts
ok "hosts seeded"

SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" npx tsx scripts/booking-seed-event-types.ts
ok "event types seeded"
cd "$REPO_ROOT"

# ── 4. google cloud oauth ───────────────────────────────────────
step "step 4 of 6: create the google cloud oauth client"

cat <<EOF
  again, manual click-through (no clean CLI for OAuth client creation).

  1. go to: ${BOLD}https://console.cloud.google.com/apis/credentials${RESET}
  2. create new project: ${BOLD}winded-vertigo-booking${RESET}
  3. go to: oauth consent screen
     - user type: external
     - app name: winded.vertigo booking
     - user support + dev email: garrett@windedvertigo.com
     - scopes: search & add:
         ${BOLD}.../auth/calendar.events${RESET}
         ${BOLD}.../auth/calendar.freebusy${RESET}
     - test users: add 5 host emails (garrett, payton, lamis, maria, james
       at @windedvertigo.com)
  4. credentials → create credentials → oauth client id
     - application type: web application
     - name: wv-booking-oauth
     - authorized redirect uris (add both):
         ${BOLD}https://windedvertigo.com/api/booking/oauth/google/callback${RESET}
         ${BOLD}http://localhost:3000/api/booking/oauth/google/callback${RESET}
  5. copy client_id + client_secret

  ${DIM}OPTIONAL but recommended: hit "publish app" to start the verification
  process. test-mode tokens expire weekly; verification takes 2-6 weeks.${RESET}

EOF

if ! confirm "ready to paste credentials?"; then
  warn "stopping. re-run when ready."
  exit 0
fi

input "paste GOOGLE_OAUTH_CLIENT_ID:" GOOGLE_OAUTH_CLIENT_ID
input "paste GOOGLE_OAUTH_CLIENT_SECRET:" GOOGLE_OAUTH_CLIENT_SECRET

[[ -z "$GOOGLE_OAUTH_CLIENT_ID" || -z "$GOOGLE_OAUTH_CLIENT_SECRET" ]] && { err "missing values"; exit 1; }

echo "GOOGLE_OAUTH_CLIENT_ID=$GOOGLE_OAUTH_CLIENT_ID" >> "$SECRETS_FILE"
echo "GOOGLE_OAUTH_CLIENT_SECRET=$GOOGLE_OAUTH_CLIENT_SECRET" >> "$SECRETS_FILE"
echo "GOOGLE_OAUTH_REDIRECT_URI=https://windedvertigo.com/api/booking/oauth/google/callback" >> "$SECRETS_FILE"
ok "google oauth creds saved locally"

# ── 5. cloudflare turnstile ─────────────────────────────────────
step "step 5 of 6: create the cloudflare turnstile widget"

cat <<EOF
  1. go to: ${BOLD}https://dash.cloudflare.com/?to=/:account/turnstile${RESET}
  2. add site:
     - site name: ${BOLD}wv-booking${RESET}
     - hostnames: ${BOLD}windedvertigo.com${RESET}, ${BOLD}localhost${RESET}
     - widget mode: managed
  3. copy site key + secret key

EOF

if ! confirm "ready to paste turnstile keys?"; then
  warn "stopping. re-run when ready."
  exit 0
fi

input "paste TURNSTILE_SITE_KEY (public):" TURNSTILE_SITE_KEY
input "paste TURNSTILE_SECRET_KEY:" TURNSTILE_SECRET_KEY

[[ -z "$TURNSTILE_SITE_KEY" || -z "$TURNSTILE_SECRET_KEY" ]] && { err "missing values"; exit 1; }

echo "TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY" >> "$SECRETS_FILE"
echo "TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET_KEY" >> "$SECRETS_FILE"
ok "turnstile keys saved locally"

# ── 6. push secrets to wrangler ─────────────────────────────────
step "step 6 of 6: push secrets to cloudflare workers"

cat <<EOF
  the local file ${BOLD}site/.secrets-do-not-commit/booking.env${RESET} now
  contains all the booking secrets. each one needs to be pushed to the
  wv-site Worker via wrangler secret put.

  this script will pipe them in for you. wrangler will prompt you to
  log in if it isn't already (cloudflare account: garrett).

EOF

cd "$SITE_DIR"

push_secret() {
  local key="$1"
  local val
  val="$(grep "^$key=" "$SECRETS_FILE" | head -1 | cut -d= -f2-)"
  if [ -z "$val" ]; then
    err "missing $key in $SECRETS_FILE"
    return 1
  fi
  echo -n "$val" | wrangler secret put "$key" >/dev/null 2>&1 && ok "$key" || err "$key failed"
}

push_secret SUPABASE_URL
push_secret SUPABASE_SERVICE_ROLE_KEY
push_secret GOOGLE_OAUTH_CLIENT_ID
push_secret GOOGLE_OAUTH_CLIENT_SECRET
push_secret GOOGLE_OAUTH_REDIRECT_URI
push_secret BOOKING_TOKEN_KEY
push_secret BOOKING_SIGNING_KEY
push_secret BOOKING_ADMIN_TOKEN
push_secret TURNSTILE_SECRET_KEY

cat <<EOF

  TURNSTILE_SITE_KEY is public — also add it to wrangler.jsonc vars.
  manual edit (one-time):
    open ${BOLD}site/wrangler.jsonc${RESET}
    add to "vars": "TURNSTILE_SITE_KEY": "$TURNSTILE_SITE_KEY"

EOF

cd "$REPO_ROOT"

# ── done ────────────────────────────────────────────────────────
step "✓ setup complete"

cat <<EOF

  what's left (NOT automated — physically requires each host):

  1. each of the 5 collective members visits:
       ${BOLD}https://windedvertigo.com/admin/booking/connect?admin=YOUR_ADMIN_TOKEN${RESET}
     and clicks "connect" next to their name. one OAuth consent each.

     your BOOKING_ADMIN_TOKEN is in:
       ${SECRETS_FILE}

  2. once everyone is connected, smoke-test:
       cd $SITE_DIR
       SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
       GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \\
       BOOKING_TOKEN_KEY=... \\
       npx tsx scripts/booking-test-freebusy.ts garrett 2026-05-01 2026-05-08

  3. visit ${BOLD}windedvertigo.com/book/garrett${RESET} from incognito
     and book yourself a test playdate.

  ${DIM}all paths and tokens are in $SECRETS_FILE${RESET}
  ${DIM}delete that file after onboarding all 5 hosts if you want extra paranoia${RESET}

EOF

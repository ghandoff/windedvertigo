# deep.deck — Deployment Checklist

## Environment Variables

### Required (Stripe)

| Variable | Description | Where to get it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Stripe Dashboard > Developers > API keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Dashboard > Developers > Webhooks > Signing secret |
| `NEXT_PUBLIC_STRIPE_PRICE_FULL_DECK` | Price ID for the Full Deck product | Stripe Dashboard > Products > Full Deck > Price ID (defaults to `price_1T77cvD50swbC2DgVxutmKNr`) |

### Required (Database)

| Variable | Description | Where to get it |
| --- | --- | --- |
| `POSTGRES_URL` | Neon Postgres connection string | Neon Dashboard > Connection Details |

### Required (Auth)

| Variable | Description | Where to get it |
| --- | --- | --- |
| `AUTH_SECRET` | NextAuth.js secret (min 32 chars) | Generate: `openssl rand -base64 32` |
| `AUTH_URL` | Full base URL of the app | e.g. `https://windedvertigo.com/reservoir/deep-deck` |

### Optional (Auth Providers)

| Variable | Description | Where to get it |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend API key for magic link emails | resend.com > API Keys |
| `EMAIL_FROM` | Sender email for magic links | Default: `noreply@windedvertigo.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console > Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console > Credentials |

## Database Setup

Run the migration against your Neon Postgres database:

```bash
# Option 1: Neon SQL Editor
# Paste the contents of migrations/001_initial_schema.sql into the Neon Dashboard SQL Editor

# Option 2: psql
psql "$POSTGRES_URL" -f migrations/001_initial_schema.sql
```

## Stripe Webhook

Webhook endpoint: `https://windedvertigo.com/reservoir/deep-deck/api/webhook`

Events to listen for:
- `checkout.session.completed`

## Going Live with Stripe

When ready to accept real payments:

1. In Stripe Dashboard, toggle from "Test mode" to live
2. Create a new product + price in live mode (or use the existing test ones if on the same account)
3. Update Vercel env vars:
   - `STRIPE_SECRET_KEY` → live key (`sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` → new webhook signing secret for the live endpoint
   - `NEXT_PUBLIC_STRIPE_PRICE_FULL_DECK` → live price ID (if different)
4. Add a new webhook endpoint in live mode pointing to the same URL
5. Redeploy

## Local Development

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:3000/reservoir/deep-deck/api/webhook

# The CLI will print a webhook signing secret — use it as STRIPE_WEBHOOK_SECRET locally
```

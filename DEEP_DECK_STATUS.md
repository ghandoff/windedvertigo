# deep.deck Monetization — Status & Handoff

Last updated: 2026-03-05

## Branch

- **Feature branch:** `claude/monetize-deep-deck-vgk3n`
- **Base branch:** `main`
- **Remote:** `origin/claude/monetize-deep-deck-vgk3n` (pushed and up to date)
- **Merge conflicts with main:** resolved and committed (`b9f9b4e`)

## What was built (10 commits on feature branch)

1. **Stripe Checkout flow** — pack-based monetization with checkout session creation, success/cancel pages
2. **Server-side payment verification** — webhook handler validates `checkout.session.completed` events
3. **Auth.js + Neon Postgres** — Google OAuth login with persistent user/account/entitlement storage
4. **Protected card data** — card content gated behind verified entitlements
5. **Shared WV branding** — header/footer match the main site design system
6. **Nav bar + UX polish** — deployment docs, navigation, graceful degradation without DB
7. **Merge with main** — 3 conflicts resolved (layout, header, next.config)

## Stripe resources (TEST MODE)

| Resource | Value |
|----------|-------|
| Product | Full Deck |
| Price ID | `price_1T77cvD50swbC2DgVxutmKNr` |
| Amount | $9.99 USD (one-time) |
| Payment link | `https://buy.stripe.com/test_9B66oGeUd8Ba3FM3On0Fi00` |

## Database

**Schema file:** `apps/deep-deck/migrations/001_initial_schema.sql`

Tables: `users`, `accounts`, `verification_token`, `purchases`, `entitlements`

### To set up Neon DB:
1. Go to https://neon.tech → Create project (e.g. "deep-deck")
2. Copy the connection string (starts with `postgres://...`)
3. Open SQL Editor → paste contents of `001_initial_schema.sql` → Run

## Environment variables needed

Set these in Vercel project settings for `deep-deck`:

```
# Database
POSTGRES_URL=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Auth.js
AUTH_SECRET=wXOC9ex2K9d79wXrCdGET0HQFPsgQ0sKGqeAaphAFrw=
AUTH_URL=https://windedvertigo.com/reservoir/deep-deck
NEXTAUTH_URL=https://windedvertigo.com/reservoir/deep-deck

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Stripe
STRIPE_SECRET_KEY=<from Stripe dashboard>
NEXT_PUBLIC_STRIPE_PRICE_FULL_DECK=price_1T77cvD50swbC2DgVxutmKNr
STRIPE_WEBHOOK_SECRET=<from webhook setup below>

# Optional
EMAIL_FROM=noreply@windedvertigo.com
RESEND_API_KEY=<if using email magic links>
```

## Remaining manual steps

### 1. Create Pull Request
```
Branch: claude/monetize-deep-deck-vgk3n → main
Title: feat(deep-deck): add pack-based monetization with Stripe checkout
```

### 2. Set up Neon database
See "Database" section above.

### 3. Set Vercel environment variables
See "Environment variables" section above. Set for Production + Preview.

### 4. Create Stripe webhook
- Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://windedvertigo.com/reservoir/deep-deck/api/webhook`
- Events: `checkout.session.completed`
- Copy signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel

### 5. Google OAuth (if not already configured)
- Google Cloud Console → APIs & Services → Credentials
- Authorized redirect URI: `https://windedvertigo.com/reservoir/deep-deck/api/auth/callback/google`

### 6. Merge PR and verify deployment
After merging, Vercel auto-deploys. Verify:
- Landing page loads at `/reservoir/deep-deck`
- Google sign-in works
- Stripe checkout redirects correctly
- Webhook creates entitlement after test purchase
- Card content unlocks for entitled users

## Architecture overview

```
apps/deep-deck/
├── app/
│   ├── page.tsx              # Landing + pack cards
│   ├── api/
│   │   ├── checkout/route.ts # Creates Stripe checkout session
│   │   └── webhook/route.ts  # Handles Stripe webhook events
│   └── success/page.tsx      # Post-purchase confirmation
├── auth.ts                   # Auth.js config (Google + Neon adapter)
├── lib/
│   ├── packs.ts              # Pack definitions & pricing
│   ├── db.ts                 # Neon Postgres client
│   └── stripe.ts             # Stripe client init
└── migrations/
    └── 001_initial_schema.sql
```

## Key files changed from main

Run `git diff main...claude/monetize-deep-deck-vgk3n --name-only` to see full list.

# Vercel Environment Variable Scoping Remediation Plan

**Project:** wv-crm  
**Team:** ghandoffs-projects  
**Date Created:** 2026-04-14  
**Status:** DRAFT

## Executive Summary

The `wv-crm` project has **52 environment variables**, with **23 secrets improperly scoped** to Preview and/or Development environments. Preview deployments have **no authentication protection**, meaning anyone with a preview URL can access API routes protected only by these exposed secrets.

**Critical Risk:** An attacker discovering a preview URL could:
- Call authenticated API routes using `CRON_SECRET` or `AUTH_SECRET`
- Access external services (Google, LinkedIn, Bluesky, Resend) with stored credentials
- Incur API charges via `ANTHROPIC_API_KEY`, `RESEND_API_KEY`
- Modify data via `NOTION_TOKEN`, or R2 file storage
- Trigger emails via `RESEND_API_KEY`
- Access Gmail and social accounts via refresh tokens and OAuth credentials

---

## Variables Requiring Immediate Remediation (P0)

**Do today.** These are cryptographic secrets and API keys that directly gate sensitive operations.

### 1. CRON_SECRET
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview and Development entirely**  
**Why:** This secret gates all cron-triggered API routes. Exposed in preview, any attacker can trigger scheduled jobs without authentication. No non-production value needed—cron jobs should not run on preview deployments.  
**Action:** Delete from preview/dev environments in Vercel dashboard.  
**Priority:** P0

### 2. AUTH_SECRET
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview and Development entirely**  
**Why:** This is the NextAuth session signing key. Exposed in preview, an attacker can forge session cookies and impersonate any user. This is the crown jewel of authentication bypass.  
**Action:** Delete from preview/dev environments in Vercel dashboard.  
**Priority:** P0

### 3. ANTHROPIC_API_KEY
**Current Scoping:** Production, Development (also listed under "Production Only" but appears in dev)  
**Recommendation:** **Remove from Development**  
**Why:** Each API call to Claude costs money. An exposed key in a public preview URL invites abuse. Developers should use a shared dev/test key with spend limits, or call via a secure backend endpoint.  
**Action:** 
  - Delete from dev environment
  - (Optional) Create a separate `ANTHROPIC_API_KEY_DEV` with spending limits for local development
**Priority:** P0

### 4. GMAIL_REFRESH_TOKEN
**Current Scoping:** Production, Development (appears twice in list)  
**Recommendation:** **Remove from Development**  
**Why:** This OAuth refresh token grants permanent access to the authenticated Gmail account without requiring user re-authentication. Exposed in preview, an attacker can read/send emails indefinitely.  
**Action:** Delete from dev environment. Developers should use a separate test Gmail account with its own refresh token, or mock the Gmail integration in dev.  
**Priority:** P0

### 5. RESEND_WEBHOOK_SECRET
**Current Scoping:** Production, Development (appears twice in list)  
**Recommendation:** **Remove from Development**  
**Why:** This secret validates webhook signatures from Resend (email service). Exposed in preview, an attacker can forge email delivery notifications and disrupt email flow tracking.  
**Action:** Delete from dev environment.  
**Priority:** P0

### 6. RESEND_API_KEY
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview; evaluate Development**  
**Why:** 
  - **In Preview:** Anyone with a preview URL can send unlimited emails on your Resend account, incurring costs.
  - **In Development:** Still high risk; recommend either a separate dev key with spend limits, or mock integration.
**Action:**
  - Delete from preview immediately
  - Replace in dev with `RESEND_API_KEY_DEV` (separate key with low spend limits), or use a mock/stub
**Priority:** P0 (preview); P1 (dev)

---

## Variables Requiring Remediation This Week (P1)

**This week.** These are OAuth credentials, third-party service keys, and integration tokens that require separate non-production values.

### 7. LINKEDIN_CLIENT_ID & LINKEDIN_CLIENT_SECRET
**Current Scoping:** Preview, Development  
**Recommendation:** **Replace with separate non-production OAuth client**  
**Why:** 
  - These are LinkedIn's OAuth credentials for your app
  - In preview/dev, they force users to redirect to LinkedIn and back to a non-production URL, which breaks the OAuth flow or requires LinkedIn to whitelist every preview URL
  - Exposing these allows attackers to intercept tokens or redirect user logins
**Action:**
  1. Create a new LinkedIn OAuth app for development/preview at LinkedIn's developer portal
  2. Configure it with restricted redirect URIs (e.g., `http://localhost:3000/callback`, `*.preview.vercel.app/callback` if possible, or only list specific dev app URLs)
  3. Store dev credentials separately: `LINKEDIN_CLIENT_ID_DEV`, `LINKEDIN_CLIENT_SECRET_DEV`
  4. Update Next.js config to use dev credentials when `NODE_ENV !== 'production'`
  5. Remove from preview/dev in Vercel (if using Vercel's native scoping) and manage via separate dev environment or `.env.local`
  6. If preview deployments use production credentials, apply strict OAuth token validation and rate limiting on the preview deployment
**Priority:** P1

### 8. BLUESKY_APP_PASSWORD & BLUESKY_HANDLE
**Current Scoping:** Preview, Development  
**Recommendation:** **Replace with separate non-production account OR remove entirely**  
**Why:**
  - `BLUESKY_APP_PASSWORD` is a login credential for Bluesky's public API. Exposed, an attacker can publish posts, follow/unfollow, and modify account settings on your Bluesky account.
  - `BLUESKY_HANDLE` is less sensitive but reveals which account is integrated.
**Action:**
  1. Option A (Recommended): Create a separate test Bluesky account for development
     - Store dev credentials as `BLUESKY_APP_PASSWORD_DEV`, `BLUESKY_HANDLE_DEV`
     - Update code to use dev credentials in non-production
  2. Option B: Remove from preview/dev entirely if the feature can be disabled (e.g., feature flag)
  3. Remove production credentials from preview/dev in Vercel
**Priority:** P1

### 9. GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Keep production values in prod only; create separate OAuth app for dev/preview**  
**Why:**
  - These are your Google OAuth credentials
  - Google OAuth requires whitelisting redirect URIs. Using production credentials in preview forces you to either:
    - Whitelist every possible preview URL (breaks security)
    - Accept that users can't actually log in via Google on preview (bad UX)
  - Exposing credentials allows token interception and session hijacking
**Action:**
  1. Create a separate Google OAuth app for development at Google Cloud Console
  2. Configure with redirect URIs: `http://localhost:3000/api/auth/callback/google`, `*.preview.vercel.app/api/auth/callback/google` (if supported), or specific known preview URLs
  3. Store credentials separately: `GOOGLE_CLIENT_ID_DEV`, `GOOGLE_CLIENT_SECRET_DEV`
  4. Update Next.js Auth config (NextAuth) to use dev credentials when `NODE_ENV !== 'production'`
  5. Remove production Google credentials from preview/dev scoping in Vercel
**Priority:** P1

### 10. NOTION_TOKEN
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview; create separate token for Development**  
**Why:**
  - This token grants full access to your Notion workspace(s). Exposed in preview, an attacker can read, modify, or delete all Notion pages and databases accessible to this token.
**Action:**
  1. Create a separate Notion integration for development (in your Notion workspace settings)
  2. Connect it only to a specific test database, not the entire workspace
  3. Store as `NOTION_TOKEN_DEV`, point to test workspace
  4. Remove production token from preview/dev in Vercel
  5. For preview, either remove entirely or create a third read-only token
**Priority:** P1

### 11. R2_SECRET_ACCESS_KEY & R2_ACCESS_KEY_ID
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview; evaluate Development**  
**Why:**
  - These are Cloudflare R2 (S3-compatible storage) credentials
  - Exposed in preview, an attacker can list, download, upload, or delete files in your R2 bucket
  - High risk if bucket contains user-uploaded files, PDFs, or sensitive documents
**Action:**
  1. Create a separate Cloudflare R2 bucket for development (or use a subfolder policy if supported)
  2. Generate separate API credentials with minimal permissions (e.g., write-only, or restricted to a prefix like `dev/`)
  3. Store as `R2_SECRET_ACCESS_KEY_DEV`, `R2_ACCESS_KEY_ID_DEV`
  4. Store separate bucket name: `R2_BUCKET_NAME_DEV`
  5. Remove production credentials from preview/dev in Vercel
**Priority:** P1

### 12. RESEND_REPLY_TO & RESEND_DOMAIN
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview; keep in Development with non-production values**  
**Why:**
  - `RESEND_DOMAIN` is the sender domain for emails (e.g., `noreply@wv-crm.com`)
  - `RESEND_REPLY_TO` is the reply-to address
  - These are moderately sensitive: exposed, an attacker can send emails appearing to come from your domain
  - Less critical than the API key itself, but still should be separate
**Action:**
  1. Create a separate Resend sender domain for development (e.g., `dev-noreply@wv-crm.com` or use a test domain)
  2. Store as `RESEND_DOMAIN_DEV`, `RESEND_REPLY_TO_DEV`
  3. Remove from preview; remove production values from dev
**Priority:** P1

### 13. R2_PUBLIC_URL & R2_BUCKET_NAME
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Replace with non-production values in Preview/Development**  
**Why:**
  - These are non-secret but infrastructure-specific
  - If they point to your production R2 bucket, the app will try to serve/store files in prod infrastructure during preview testing
  - Can cause data leakage or accidental overwrites if the app logic isn't careful
**Action:**
  1. Create a separate R2 bucket for development: `wv-crm-dev`
  2. Set `R2_BUCKET_NAME_DEV` in dev environment
  3. Set `R2_PUBLIC_URL_DEV` to the dev bucket's public URL
  4. Update app code to read `R2_BUCKET_NAME` and `R2_PUBLIC_URL` based on environment
  5. Ensure preview deployments use dev values
**Priority:** P1

### 14. CF_ACCOUNT_ID
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Remove from Preview; evaluate Development**  
**Why:**
  - This is your Cloudflare Account ID
  - Less sensitive than the API key, but combined with the R2 keys above, allows full access to your Cloudflare account
**Action:**
  1. If using R2 in dev/preview, use the same Account ID (single Cloudflare account) but apply restrictions via scoped API tokens
  2. If possible, create separate API tokens for dev/preview with minimal permissions (e.g., R2-only, dev-bucket-only)
  3. Remove from preview; keep in dev if needed, but only with scoped tokens
**Priority:** P1

---

## Variables Requiring Conditional Remediation (P2)

**Next sprint or after P0/P1 complete.** These are moderately sensitive or require additional analysis.

### 15. AUTH_TRUST_HOST
**Current Scoping:** Production, Preview, Development  
**Recommendation:** **Keep in all environments (non-sensitive)**  
**Why:** This is a plain boolean (`true`/`false`) that tells NextAuth to trust the `X-Forwarded-Host` header. It's non-sensitive and necessary for OAuth redirects to work correctly on preview/dev environments.  
**Action:** No change needed. This is safe to expose.  
**Priority:** P2 (no action)

### 16. GOOGLE_SA_RFP_SCANNER
**Current Scoping:** Production only ✓  
**Recommendation:** **No change needed**  
**Why:** Already production-only. This is a Google Service Account key for a specific scanning utility.  
**Action:** Verify this is indeed production-only and document that it should remain so.  
**Priority:** P2 (no action)

---

## Summary: What to Remove vs. Replace

| Variable | Current Scope | Action | Justification |
|----------|---------------|--------|---------------|
| CRON_SECRET | prod, preview, dev | **Remove from preview, dev** | Unauthenticated cron endpoint |
| AUTH_SECRET | prod, preview, dev | **Remove from preview, dev** | Session forgery risk |
| ANTHROPIC_API_KEY | prod, dev | **Remove from dev** | Billing abuse |
| GMAIL_REFRESH_TOKEN | prod, dev | **Remove from dev** | Account takeover |
| RESEND_WEBHOOK_SECRET | prod, dev | **Remove from dev** | Webhook forgery |
| RESEND_API_KEY | prod, preview, dev | **Remove from preview; replace in dev** | Billing abuse + replace with dev key |
| LINKEDIN_CLIENT_ID | preview, dev | **Replace with dev OAuth app** | OAuth flow requires separate app |
| LINKEDIN_CLIENT_SECRET | preview, dev | **Replace with dev OAuth app** | OAuth flow requires separate app |
| BLUESKY_APP_PASSWORD | preview, dev | **Replace with test account or remove** | Account takeover |
| BLUESKY_HANDLE | preview, dev | **Replace with test account or remove** | Account takeover |
| GOOGLE_CLIENT_ID | prod, preview, dev | **Replace with dev OAuth app** | OAuth flow requires separate app |
| GOOGLE_CLIENT_SECRET | prod, preview, dev | **Replace with dev OAuth app** | OAuth flow requires separate app |
| NOTION_TOKEN | prod, preview, dev | **Remove from preview; replace in dev** | Workspace takeover |
| R2_SECRET_ACCESS_KEY | prod, preview, dev | **Remove from preview; replace in dev** | File storage access |
| R2_ACCESS_KEY_ID | prod, preview, dev | **Remove from preview; replace in dev** | File storage access |
| RESEND_REPLY_TO | prod, preview, dev | **Remove from preview; replace in dev** | Email impersonation |
| RESEND_DOMAIN | prod, preview, dev | **Remove from preview; replace in dev** | Email impersonation |
| R2_PUBLIC_URL | prod, preview, dev | **Replace in preview, dev** | Infrastructure isolation |
| R2_BUCKET_NAME | prod, preview, dev | **Replace in preview, dev** | Infrastructure isolation |
| CF_ACCOUNT_ID | prod, preview, dev | **Remove from preview; evaluate dev** | Account access (scoped tokens recommended) |

---

## Implementation Roadmap

### Phase 1: P0 Actions (Today)
1. **Remove `CRON_SECRET` from preview and development** → Vercel dashboard → Environment Variables
2. **Remove `AUTH_SECRET` from preview and development**
3. **Remove `ANTHROPIC_API_KEY` from development**
4. **Remove `GMAIL_REFRESH_TOKEN` from development**
5. **Remove `RESEND_WEBHOOK_SECRET` from development**
6. **Remove `RESEND_API_KEY` from preview** (delete entirely)
7. **Delete non-sensitive test values from preview if present** (e.g., orphaned keys from previous branches)

**Verification:** Run `vercel env list` or check Vercel dashboard. Confirm no secret values appear in preview/dev environments.

### Phase 2: P1 Actions (This Week)
1. **Create separate Google OAuth app for development**
   - Add `GOOGLE_CLIENT_ID_DEV`, `GOOGLE_CLIENT_SECRET_DEV` to dev environment
   - Update `src/app/api/auth/[...nextauth].ts` to use dev credentials when `NODE_ENV !== 'production'`

2. **Create separate LinkedIn OAuth app for development**
   - Add `LINKEDIN_CLIENT_ID_DEV`, `LINKEDIN_CLIENT_SECRET_DEV` to dev environment
   - Update relevant integration code to use dev credentials in non-prod

3. **Create separate Bluesky test account**
   - Add `BLUESKY_APP_PASSWORD_DEV`, `BLUESKY_HANDLE_DEV` to dev environment
   - Remove production Bluesky credentials from preview/dev

4. **Create separate Notion test workspace/database**
   - Add `NOTION_TOKEN_DEV` pointing to test workspace
   - Remove production Notion token from preview/dev

5. **Create separate R2 bucket for development**
   - Set `R2_BUCKET_NAME_DEV`, `R2_PUBLIC_URL_DEV`, `R2_SECRET_ACCESS_KEY_DEV`, `R2_ACCESS_KEY_ID_DEV`
   - Update app code to detect environment and use appropriate bucket

6. **Create separate Resend domain/account for development (if possible)**
   - Or: create new verified domain for dev (e.g., `dev-noreply@wv-crm.com`)
   - Add `RESEND_DOMAIN_DEV`, `RESEND_REPLY_TO_DEV`, `RESEND_API_KEY_DEV`

7. **Remove production credentials from preview in Vercel dashboard**
   - Double-check that preview deployments can still function (may require feature flags for certain integrations)

### Phase 3: P2 Actions (Next Sprint)
1. Audit environment variable usage in codebase
2. Update integration tests to use dev credentials
3. Document the credential separation in project README
4. Add CI/CD checks to prevent production secrets from being deployed to non-prod

---

## Testing & Verification

After each phase, verify:

1. **Preview deployments work:** Trigger a preview deployment and confirm key flows function (Google login, email sending, file upload, etc.). Some features may be disabled if no dev credentials are provided.

2. **Production works:** Trigger a production deployment and confirm all integrations work with production credentials.

3. **No secrets leaked:** 
   ```bash
   # Check Vercel environment variables
   vercel env list
   
   # Grep the repo for hardcoded secrets (should be none)
   git grep -i "RESEND_API_KEY\|AUTH_SECRET\|CRON_SECRET" -- ':!docs/' ':!.git/'
   ```

4. **No accidental cross-environment calls:** 
   - In preview, verify emails go to dev Resend account (if configured)
   - In preview, verify file uploads go to dev R2 bucket
   - In preview, verify Notion reads from test workspace

---

## Notes for Team

1. **OAuth Redirect URIs:** When creating separate OAuth apps (Google, LinkedIn), carefully configure redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/...`
   - Preview: Either specific known URLs or use a wildcard if your OAuth provider supports it (most don't). As a workaround, you can accept one or two preview app URLs.
   - Production: Exact production domain only

2. **Feature Flags:** Consider adding feature flags for integrations that don't have dev credentials (e.g., Bluesky, Substack) so they gracefully degrade in preview/dev without causing app errors.

3. **Cost Control:** 
   - Set spending limits on dev API keys (Anthropic, Resend, Google) in the respective dashboards
   - Monitor dev R2 bucket usage if it's in the same account

4. **Documentation:** Update `.env.example` to show the separate dev variable names so developers know what to set up locally.

---

## References
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- OWASP: Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- NextAuth.js Securing Your Deployment: https://next-auth.js.org/deployment/securing-your-deployment

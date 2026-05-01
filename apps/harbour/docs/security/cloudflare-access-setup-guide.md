# Cloudflare Access (Zero Trust) Setup Guide for port.windedvertigo.com

**Prepared for:** Winded Vertigo  
**Date:** April 2026  
**Campaign Launch:** Today (April 14, 2026)  
**Status:** High-priority, zero-downtime deployment

This guide provides step-by-step instructions for protecting `port.windedvertigo.com` with Cloudflare Access (Zero Trust) using Google Workspace SSO, combined with WAF and DDoS protection from Cloudflare's Standard plan.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Gather Required Information](#step-1-gather-required-information)
4. [Step 2: Enable Cloudflare Zero Trust](#step-2-enable-cloudflare-zero-trust)
5. [Step 3: Configure Google as Identity Provider](#step-3-configure-google-as-identity-provider)
6. [Step 4: Create Access Policies](#step-4-create-access-policies)
7. [Step 5: Enable Proxy and SSL Configuration](#step-5-enable-proxy-and-ssl-configuration)
8. [Step 6: Testing Without Breaking Production](#step-6-testing-without-breaking-production)
9. [Step 7: Production Deployment](#step-7-production-deployment)
10. [Step 8: WAF and DDoS Protection](#step-8-waf-and-ddos-protection)
11. [Rollback Plan](#rollback-plan)
12. [Ongoing Maintenance](#ongoing-maintenance)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You Need Before Starting

1. **Cloudflare Account Access**
   - Account: garrett@windedvertigo.com ("Gearbox" account)
   - Account ID: (visible in dashboard footer)
   - Role: Administrator (required for Zero Trust and DNS changes)

2. **DNS Zone Information**
   - Domain: `windedvertigo.com`
   - Zone already on Cloudflare (nameservers: lana.ns.cloudflare.com + ed.ns.cloudflare.com)
   - Current DNS record: A record pointing to 76.76.21.21 (Vercel's anycast IP)
   - Proxying status: Currently DNS-only (grey cloud)

3. **Vercel Project**
   - Deployment platform: Vercel (Next.js app)
   - Current environment variables stored: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - Vercel project slug/name: (note this for domain verification later)

4. **Google Workspace Access**
   - Organization: windedvertigo.com domain
   - Admin account: garrett@windedvertigo.com
   - Admin console access: (someone with Super Admin role)
   - OAuth scope access (for creating OAuth 2.0 credentials)

5. **Team Information**
   - Number of team members: (for licensing — free tier supports up to 50 users)
   - Google Workspace user list: (list of @windedvertigo.com email addresses to grant access)

6. **Technical Requirements**
   - Modern browser (Chrome, Firefox, Safari, Edge)
   - Ability to modify DNS records in Cloudflare dashboard
   - Ability to manage Vercel domain settings
   - Access to Google Workspace Admin Console

### Downtime Considerations

- Cloudflare Access deployment is zero-downtime when done correctly
- DNS proxy switch (grey to orange cloud) happens at one moment; plan a 5-minute testing window
- SSL/TLS certificate validation may require a brief pause
- Estimated total deployment time: 45 minutes (non-blocking steps can overlap)

---

## Architecture Overview

### Current State
```
User → port.windedvertigo.com → Vercel (76.76.21.21) → Next.js app
                    ↓
           Cloudflare DNS (grey cloud)
           - No proxying
           - App-level Google OAuth
```

### After Implementation
```
User → port.windedvertigo.com → Cloudflare Access (orange cloud)
                                        ↓
                              Google Workspace login
                                        ↓
                                   [Policy check]
                                        ↓
                            Vercel (76.76.21.21)
                                   ↓
                              Next.js app
```

### Key Differences

- **Authentication layer moves to Cloudflare** (outside the app)
- **Google OAuth credentials** become Cloudflare IdP settings (not app-level)
- **Application-level Google OAuth** can be removed (no longer needed)
- **WAF rules** automatically applied to all traffic
- **DDoS protection** included in Cloudflare's network

---

## Step 1: Gather Required Information

### 1.1 From Cloudflare Dashboard

1. Log into dashboard.cloudflare.com with garrett@windedvertigo.com
2. Navigate to **Gearbox account** (if not already there)
3. Select domain: `windedvertigo.com`
4. Go to **Overview** and note:
   - Account ID (bottom right of sidebar)
   - Zone ID (top of Overview page)
   - Current plan level (Standard or higher needed for this setup)
5. Go to **DNS > Records**:
   - Verify current A record: `port.windedvertigo.com` → `76.76.21.21` (should be grey cloud)

### 1.2 From Vercel Project

1. Log into vercel.com
2. Select the project serving port.windedvertigo.com
3. Go to **Settings > Domains**:
   - Note the domain name and status
   - Look for any verification TXT records (may be needed later)
4. Go to **Settings > Environment Variables**:
   - Note GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET values (keep secret; screenshot if needed)

### 1.3 From Google Workspace Admin Console

1. Go to admin.google.com with garrett@windedvertigo.com
2. Verify you have **Super Admin** role or equivalent
3. Go to **Apps > Web and mobile apps > Manage OAuth 2.0**:
   - This is where you'll create new OAuth credentials for Cloudflare
4. Go to **Directory > Users**:
   - Count and list all team members who should have access (@windedvertigo.com domain)

### 1.4 Create a Secure Notes File

Create a temporary text file (or use a password manager) with:
```
Domain: port.windedvertigo.com
Cloudflare Account: garrett@windedvertigo.com
Cloudflare Account ID: [INSERT]
Zone ID: [INSERT]
Vercel Project: [INSERT PROJECT NAME]
Current A Record: 76.76.21.21 (grey cloud)
Google Workspace Domain: windedvertigo.com
Google Workspace Admin: garrett@windedvertigo.com
Team Members to Allow: [LIST @windedvertigo.com EMAILS]
```

Keep this file secure and delete it when deployment is complete.

---

## Step 2: Enable Cloudflare Zero Trust

### 2.1 Access Zero Trust Dashboard

1. Log into dashboard.cloudflare.com
2. In the left sidebar, select **Zero Trust** (or navigate to zero.cloudflare.com)
3. If this is your first time, you'll see an onboarding screen; click **Start Setup**
4. You may be prompted to choose a plan:
   - **Free Plan**: Up to 50 users, basic Access features
   - **Pro/Business**: Additional features, higher user limit
   - **Choose Free** for this deployment (supports up to 50 users, which is typical for small agencies)

### 2.2 Choose a Team Domain

Cloudflare will prompt you to create a **team domain**. This is used for Access login pages (e.g., `yourteam.cloudflareaccess.com`).

**Choose a team name:**
- Suggestion: `windedvertigo` (results in `windedvertigo.cloudflareaccess.com`)
- Must be globally unique on Cloudflare's system
- Consider adding a qualifier if conflicts occur: `windedvertigo-port` or `wv-access`

**Example Login URL:** `https://windedvertigo.cloudflareaccess.com`

### 2.3 Set Up CNAME for Custom Domain (Optional but Recommended)

You can optionally create a CNAME so the login page appears to come from your own domain rather than `cloudflareaccess.com`:

1. In Zero Trust dashboard, go to **Settings > Authentication > Login Page**
2. Note the option to create a custom CNAME for login (e.g., `login.windedvertigo.com`)
3. For now, **skip this**; we'll come back if needed

### 2.4 Complete Initial Setup

- Follow Cloudflare's setup wizard to completion
- You'll land on the Zero Trust main dashboard

**Checkpoint:** You now have a Zero Trust organization created.

---

## Step 3: Configure Google as Identity Provider

### 3.1 Create Google OAuth Credentials in Google Workspace Admin Console

1. Go to **admin.google.com**
2. Navigate to **Apps > Web and mobile apps > Manage OAuth 2.0**
3. Click **Create OAuth Client ID**
4. When prompted for application type, select **Web application**
5. Set the following:
   - **Name:** `Cloudflare Access - port.windedvertigo.com`
   - **Authorized JavaScript origins:**
     - `https://windedvertigo.cloudflareaccess.com` (your team domain from Step 2.2)
     - If you set up a custom CNAME login later, add that too
   - **Authorized redirect URIs:**
     - `https://windedvertigo.cloudflareaccess.com/cdn-cgi/access/callback`
     - (Replace `windedvertigo` with your actual team domain if different)
6. Click **Create**
7. Copy the resulting **Client ID** and **Client Secret**
   - Store these securely (do not commit to version control)
   - You'll paste them into Cloudflare in the next step

**Security note:** These are different from your app-level Google OAuth credentials. They authorize Cloudflare (not your app) to verify users with Google.

### 3.2 Add Google as Identity Provider in Cloudflare Zero Trust

1. Go to **Zero Trust dashboard** > **Settings > Authentication > Login methods**
2. Find **Google** in the list and click **Add**
3. Paste the **Client ID** and **Client Secret** from Step 3.1
4. Under **Organization**, select your Google Workspace domain (`windedvertigo.com`)
   - Cloudflare will verify it has access to your Google Workspace organization
5. Click **Save**

### 3.3 Restrict to Google Workspace Domain

This ensures only `@windedvertigo.com` users can log in (not any Google account):

1. Still in **Settings > Authentication > Login methods**, find Google and click **Configure**
2. Look for **Organization** or **Domain** restrictions
3. Ensure it shows: `windedvertigo.com` (should already be set from Step 3.2)
4. Save changes

**Checkpoint:** Google Workspace is now the identity provider. Any `@windedvertigo.com` user can log in to Cloudflare Access.

---

## Step 4: Create Access Policies

### 4.1 Understand Access Policies

Access policies control **who can reach what**. You'll create one policy for `port.windedvertigo.com`:
- **Include rule:** Allow @windedvertigo.com users
- **Require rule:** Must be on a trusted device / must pass additional checks (optional)

### 4.2 Create the Policy

1. In Zero Trust dashboard, go to **Access > Applications** (or **Applications > Access**; UI may vary)
2. Click **Add Application**
3. Select **Self-Hosted** (since Vercel is externally hosted, but you're adding the Cloudflare proxy in front)

### 4.3 Configure Application

**Application details:**
- **Subdomain (or domain):** `port`
- **Domain:** `windedvertigo.com`
  - Combined: `port.windedvertigo.com`
- **Application type:** SaaS app (or Self-Hosted; either works)

### 4.4 Set Up Authentication Policy

1. Scroll to **Policies** section
2. Click **Add policy**
3. **Policy name:** `Windedvertigo Team - Google Workspace`

### 4.5 Configure Policy Rules

Under the policy, set up **Allow** and **Require** rules:

**INCLUDE Rule (Allow Access):**
1. Click **Add rule** (or **+ Add Include**)
2. Rule type: **Include**
3. Condition: **Emails** (from Directory) or **Email domains**
4. Select **Email domains**
5. Value: `windedvertigo.com`
6. Save

This means: Any email from @windedvertigo.com is allowed.

**OPTIONAL: Require Rule (Additional Checks)**

For additional security, you can require:
- MFA (Multi-Factor Authentication)
- Device compliance (Managed devices only)
- IP restrictions

For a small agency, you can skip this initially and add it later. Stick with the Include rule above for now.

### 4.6 Review and Create Application

1. Review all settings:
   - Subdomain: `port`
   - Domain: `windedvertigo.com`
   - Application type: SaaS
   - Policy: One policy with Include rule for `windedvertigo.com`
2. Note the **Application UUID** (you'll need this when updating DNS)
3. Click **Save application**

**Checkpoint:** Access policy is created. Cloudflare knows: "Let @windedvertigo.com users through to port.windedvertigo.com."

---

## Step 5: Enable Proxy and SSL Configuration

### 5.1 Change DNS to Proxied (Orange Cloud)

**CRITICAL STEP:** This activates the Cloudflare proxy. Do this during a low-traffic window if possible, though Cloudflare minimizes disruption.

1. Go to **Cloudflare Dashboard > Domain: windedvertigo.com > DNS > Records**
2. Find the A record for `port.windedvertigo.com` → `76.76.21.21`
3. Click the record to edit
4. Toggle the **Proxy status** from **DNS only** (grey cloud) to **Proxied** (orange cloud)
5. Click **Save**

**What happens:**
- Cloudflare now sits between user and Vercel
- The A record IP changes to Cloudflare's IP (you'll see a new IP assigned)
- All HTTPS traffic goes through Cloudflare first
- Access policy is now enforced before reaching Vercel

### 5.2 Verify SSL/TLS Mode

1. Go to **Cloudflare Dashboard > Domain > SSL/TLS > Overview**
2. Check the **SSL/TLS Encryption mode**:
   - **Recommended:** **Full (Strict)**
   - Why: Vercel has its own SSL certificate; "Full (Strict)" verifies it
   - Alternative: **Full** (trusts Vercel's cert without strict validation)
3. If it's set to "Flexible" or "Off", change it to **Full (Strict)**
4. Save

### 5.3 Handle Vercel Domain Verification (if needed)

When you proxied the domain, Vercel may need to re-verify domain ownership.

**Check Vercel:**
1. Go to **Vercel > Project > Settings > Domains**
2. Look for `port.windedvertigo.com`:
   - Status may show: "Unverified" or "Verification failed"
3. If unverified:
   - Vercel will show a TXT record to add to DNS
   - Example: `_vercel=XXXX.windedvertigo.com` with value `YYYYYY`

**Add Verification TXT Record to Cloudflare:**
1. Go to **Cloudflare Dashboard > DNS > Records**
2. Click **Add record**
3. Type: **TXT**
4. Name: (enter the subdomain from Vercel, e.g., `_vercel`)
5. Content: (paste the value from Vercel)
6. TTL: Auto
7. Click **Save**
8. Return to Vercel and click **Verify Domain**

**Verification should succeed within a few minutes.**

### 5.4 Check Cloudflare Origin Configuration

Cloudflare needs to know the actual origin (where to send traffic after Access validation):

1. In **Zero Trust Dashboard > Access > Applications**
2. Click on your `port.windedvertigo.com` application
3. Look for **Origin configuration** or **Application settings**
4. Verify origin is set to the Vercel deployment
   - Cloudflare should auto-detect this as `76.76.21.21` or your Vercel CNAME
   - You can also manually set it if needed

**Checkpoint:** Domain is proxied, SSL is configured, and Vercel domain verification is handled.

---

## Step 6: Testing Without Breaking Production

### 6.1 Test with a Test User on Different Device/Network

Before rolling out to the team, test the full flow:

1. **Have a non-admin test user account:**
   - Create a temporary test account in Google Workspace (e.g., `test@windedvertigo.com`)
   - Give it a password you can use

2. **In an incognito/private browser window:**
   - Open `https://port.windedvertigo.com`
   - You should be redirected to `https://windedvertigo.cloudflareaccess.com` (login page)
   - Sign in with the test user account (`test@windedvertigo.com`)
   - You should be redirected back to `port.windedvertigo.com`
   - Verify the Next.js app loads and functions

3. **Test failure case:**
   - In another incognito window, try accessing with an email outside `windedvertigo.com` (e.g., a Gmail account)
   - You should see an "Access Denied" message
   - This confirms the policy is working

4. **Check that app-level Google OAuth still works (if keeping it):**
   - Once inside the app, test any features that relied on app-level Google OAuth
   - They should still function (the application-level OAuth is independent of Cloudflare Access)

### 6.2 Monitor Initial Traffic

1. Go to **Zero Trust Dashboard > Access > Applications**
2. Click your application
3. Look for **Recent activity** or **Logs** section
4. You should see login attempts and access grants for test users
5. Check for any errors or blocked requests

### 6.3 Check Vercel Deployment Health

1. Go to **Vercel Dashboard > Deployments**
2. Ensure the deployment is still healthy
3. Check **Function logs** or **Build logs** for any errors triggered by Cloudflare proxy

### 6.4 Cloudflare Analytics

1. Go to **Cloudflare Dashboard > Analytics**
2. Check for traffic spikes, increased error rates, or unusual patterns
3. Ensure HTTPS traffic is dominant

### 6.5 Rollback Criteria

If you see any of these, execute the rollback plan (Step 7):
- Login page returns 502/504 errors
- App returns 403 "Access Denied" for authorized users
- Vercel returning 5xx errors for traffic from Cloudflare
- Significant traffic drop or error spike

**If all tests pass:** Proceed to Step 7 (Production Deployment).

---

## Step 7: Production Deployment

### 7.1 Notify Team (Optional but Recommended)

Send a message to the team:
- "In the next 15 minutes, port.windedvertigo.com will be protected with Cloudflare Access."
- "You'll be asked to sign in with your Google Workspace account (@windedvertigo.com)."
- "The app will work exactly the same once you're logged in."
- "If you have issues, contact Garrett."

### 7.2 Remove Test User Access (Optional)

If you created a temporary test account, delete or disable it in Google Workspace:
1. Go to **admin.google.com > Directory > Users**
2. Find `test@windedvertigo.com`
3. Click to select and delete (or suspend)

### 7.3 Grant Access to Real Team Members

Ensure all team members have access:

1. Go to **Google Workspace Admin Console > Directory > Users**
2. Verify all @windedvertigo.com users exist
3. Go to **Zero Trust > Access > Applications > port.windedvertigo.com > Policies**
4. Verify the policy rule includes all @windedvertigo.com users (the domain-level Include rule covers all)

No additional per-user configuration is needed; the `windedvertigo.com` domain rule applies to everyone.

### 7.4 Final Verification Steps

1. **Login as each main team user (optional but thorough):**
   - Have a few team members sign out and back in
   - Confirm seamless access for each

2. **Monitor error rates:**
   - Go to **Cloudflare Dashboard > Analytics**
   - Watch for the next 30 minutes for any spikes

3. **Check Zero Trust logs:**
   - Go to **Zero Trust > Logs > Access**
   - Confirm you see login events for team members

### 7.5 Update Documentation

In your internal docs, add:
```
port.windedvertigo.com is now protected with Cloudflare Access.

To access:
1. Go to https://port.windedvertigo.com
2. Sign in with your @windedvertigo.com email
3. Approve any device/browser prompts
4. You're in!

Forgot your password? Reset it in Google Workspace admin console.
```

**Checkpoint:** Production deployment complete. All team members can access via Google Workspace login.

---

## Step 8: WAF and DDoS Protection

Cloudflare's Standard plan (or higher) includes WAF and DDoS protection by default. No additional configuration is required for basic protection, but you can customize rules:

### 8.1 Enable Managed WAF Rules

1. Go to **Cloudflare Dashboard > Security > WAF**
2. Under **Managed Rulesets**, ensure **Cloudflare Managed Ruleset** is enabled
3. Review the default rules (they protect against common attacks: SQL injection, XSS, etc.)
4. You can adjust sensitivity:
   - Go to **Override settings**
   - Set sensitivity to **Medium** (good balance of protection vs. false positives)

### 8.2 DDoS Protection

DDoS protection is automatic on all Cloudflare plans. You can monitor:

1. Go to **Cloudflare Dashboard > Security > DDoS Protection**
2. Review attack types and mitigation statistics
3. No action needed; it's all automatic

### 8.3 Additional Security Rules (Optional)

Consider these for extra hardening:

**Rate Limiting:**
1. Go to **Security > Rate Limiting**
2. Create a rule to limit login attempts:
   - Path: `/cdn-cgi/access/*` (Cloudflare Access pages)
   - Limit: 10 requests per minute per IP
   - Action: Block

**Firewall Rules:**
1. Go to **Security > Firewall Rules**
2. Add rules to block known bad actors, specific countries, etc.
3. For a small agency, default rules are usually sufficient

**Checkpoint:** WAF and DDoS protection are active.

---

## Rollback Plan

If you encounter critical issues, roll back as follows:

### Rollback Procedure

1. **Change DNS back to DNS-only (grey cloud):**
   - Go to **Cloudflare Dashboard > DNS > Records**
   - Find `port.windedvertigo.com` A record
   - Toggle proxy status back to **DNS only** (grey cloud)
   - Save
   - TTL will revert to typical values (usually 300s)
   - **Traffic now bypasses Cloudflare Access; goes directly to Vercel**

2. **Timeline:** DNS change propagates in seconds (Cloudflare is authoritative nameserver)

3. **Verify rollback:**
   - Access `https://port.windedvertigo.com` from an incognito window (no login page should appear)
   - You should see the app immediately

4. **Investigation:**
   - Check **Cloudflare Zero Trust > Logs > Access** for error messages
   - Check **Vercel > Deployments > Function Logs** for Vercel-side issues
   - Check **Cloudflare > Analytics** for error rates

### When to Rollback

- Users get repeated 403 "Access Denied" errors despite being in windedvertigo.com
- Login page is completely inaccessible (502/504 errors)
- App returns 5xx errors for authenticated traffic
- Critical features broken within 5 minutes of deployment

### After Rollback

1. Investigate root cause
2. Fix the issue (e.g., update Access policy, adjust SSL mode)
3. Re-test with test user (Step 6)
4. Attempt deployment again

---

## Ongoing Maintenance

### Adding New Team Members

When a new person joins Winded Vertigo:

1. **Create Google Workspace account:**
   - Go to **admin.google.com > Directory > Users > Create new user**
   - Add `firstname@windedvertigo.com`
   - Set password (user changes it on first login)

2. **Grant Access:**
   - No additional step needed in Cloudflare
   - The domain-level Include rule automatically grants access to all @windedvertigo.com users
   - New user will see login prompt on first visit to port.windedvertigo.com

3. **Notify user:**
   - Share login instructions from Step 7.5

### Removing Team Members

When someone leaves:

1. **Disable Google Workspace account:**
   - Go to **admin.google.com > Directory > Users**
   - Find the user and click to edit
   - Click **Suspend** or **Delete**
   - Cloudflare will revoke access on next login attempt

2. **Verify in Cloudflare Logs:**
   - Go to **Zero Trust > Logs > Access**
   - Search for the user's email
   - You should see failed login after suspension

### Updating Access Policies

To change who can access (e.g., restrict to specific users instead of all team):

1. Go to **Zero Trust > Access > Applications > port.windedvertigo.com**
2. Click **Edit Application**
3. Go to **Policies**
4. Edit the existing policy:
   - Change from domain-level rule to user-level rules
   - Example: Instead of `windedvertigo.com`, add specific emails: `garrett@windedvertigo.com`, `alice@windedvertigo.com`

### Monitoring Usage

1. **Weekly Check:**
   - Go to **Zero Trust > Logs > Access**
   - Scan for failed logins or unusual patterns
   - Check **Application audit logs** for access patterns

2. **Monthly Review:**
   - Go to **Cloudflare > Analytics**
   - Review traffic trends, error rates, WAF blocks
   - Adjust WAF sensitivity if too many false positives

### Updating Vercel Environment Variables

The app currently has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for app-level OAuth. You have two options:

**Option A: Keep them (app-level OAuth still works)**
- No changes needed
- Users will see Cloudflare login first, then app-level OAuth button (if present)
- Adds redundancy

**Option B: Remove them (rely only on Cloudflare Access)**
- Delete `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Vercel environment
- Simplify the app (no app-level OAuth code needed)
- Recommended for this setup

Decision: **Recommend Option B** to reduce complexity and remove the redundant authentication layer.

---

## Troubleshooting

### "Access Denied" for valid @windedvertigo.com users

**Symptoms:** User can see the Cloudflare login page, signs in successfully, but gets 403 Access Denied.

**Causes:**
1. Access policy rule doesn't include the user's domain
2. User email is not @windedvertigo.com in Google
3. Device/browser trust issue (if MFA is configured)

**Solutions:**
1. Verify policy includes `windedvertigo.com` domain (not specific emails)
2. Check user's Google account email in admin.google.com
3. Check **Zero Trust > Logs > Access** for detailed error message
4. Temporarily remove any Require rules (MFA, device compliance) to isolate the issue

### Login page shows 502 Bad Gateway

**Symptoms:** `https://windedvertigo.cloudflareaccess.com` returns 502 error.

**Causes:**
1. Cloudflare Zero Trust configuration incomplete
2. Google OAuth credentials are invalid or missing
3. Team domain not properly initialized

**Solutions:**
1. Go to **Zero Trust > Settings > Authentication > Login methods**
2. Verify Google is added and enabled
3. Check Client ID and Client Secret are correct
4. Try creating the application again (delete and recreate)

### App returns 502 after proxying

**Symptoms:** Login succeeds, but app shows 502 Bad Gateway.

**Causes:**
1. Vercel origin address is wrong in Cloudflare
2. SSL/TLS mode is incompatible with Vercel cert
3. Cloudflare is caching error responses

**Solutions:**
1. Verify **Zero Trust > Applications > port.windedvertigo.com > Origin configuration** points to Vercel
2. Set **SSL/TLS to Full (Strict)** in Cloudflare dashboard
3. Go to **Cloudflare > Cache > Purge Everything** and purge cache
4. Check **Vercel > Deployments > Function Logs** for actual errors

### Users see login page repeatedly (infinite loop)

**Symptoms:** User logs in, gets redirected to app, then immediately back to login page.

**Causes:**
1. Cloudflare origin is misconfigured
2. Vercel is redirecting due to HTTPS/HTTP mismatch
3. Cookie issues (Cloudflare Access token not being set)

**Solutions:**
1. Check SSL/TLS mode is **Full (Strict)**
2. Check origin in Cloudflare is accessible via HTTPS
3. Clear browser cookies and try again
4. Check **Vercel > Settings > Domains > port.windedvertigo.com** for any redirects

### Vercel domain verification fails

**Symptoms:** Vercel shows "Unverified" status for domain after proxying.

**Causes:**
1. Cloudflare DNS-only records not updated with TXT verification
2. DNS TTL is too high and record hasn't propagated

**Solutions:**
1. Add the TXT record from Vercel to Cloudflare (see Step 5.3)
2. Wait 5-10 minutes for DNS propagation
3. Click "Verify" in Vercel again
4. If still failing, check **Cloudflare > DNS > Records** to confirm TXT record is present

### WAF is blocking legitimate traffic

**Symptoms:** Users see 403 "Forbidden" errors even after logging in; Cloudflare Analytics shows WAF blocks.

**Causes:**
1. WAF sensitivity is too high
2. Specific rule is misconfigured
3. App traffic pattern matches a WAF rule

**Solutions:**
1. Go to **Cloudflare > Security > WAF > Managed Rulesets**
2. Check current sensitivity (adjust from **High** to **Medium**)
3. Review recent blocks: **Cloudflare > Analytics > Security**
4. Disable individual rules if they're causing false positives
5. Monitor and re-enable after apps behavior is verified

### Can't access Cloudflare Zero Trust dashboard

**Symptoms:** `zero.cloudflare.com` returns 403 or blank page.

**Causes:**
1. Not in correct Cloudflare account
2. Zero Trust subscription not activated
3. Browser cache issue

**Solutions:**
1. Verify you're logged into `garrett@windedvertigo.com` at dashboard.cloudflare.com
2. Verify you're in the "Gearbox" account (check account dropdown)
3. Go to **Subscriptions** and confirm Zero Trust Free tier is active
4. Clear browser cache and cookies for cloudflare.com

---

## Appendix: Useful Links

- **Cloudflare Zero Trust Dashboard:** https://zero.cloudflare.com
- **Cloudflare Main Dashboard:** https://dashboard.cloudflare.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Google Workspace Admin Console:** https://admin.google.com
- **Cloudflare Access Documentation:** https://developers.cloudflare.com/cloudflare-one/identity/idps/google/
- **Vercel + Cloudflare Guide:** https://vercel.com/guides/cloudflare

---

## Appendix: Glossary

- **Zero Trust:** Security model where all users/devices are verified before access, regardless of network location
- **Identity Provider (IdP):** Service that authenticates users (in this case, Google Workspace)
- **Access Policy:** Rules defining who can access an application
- **Cloudflare Proxy (Orange Cloud):** Traffic flows through Cloudflare before reaching the origin
- **DNS-Only (Grey Cloud):** DNS is managed by Cloudflare but traffic goes directly to origin (no proxy)
- **SSL/TLS Full (Strict):** Cloudflare verifies SSL certificates from origin (Vercel)
- **WAF:** Web Application Firewall; protects against common web attacks (SQL injection, XSS, etc.)
- **DDoS:** Distributed Denial of Service; attacks trying to overwhelm a service
- **TTL:** Time To Live; how long DNS records are cached

---

## Sign-Off

**Prepared by:** Claude Agent  
**Date:** April 14, 2026  
**Status:** Ready for deployment

Once deployed, share this guide with the team and retain for future reference on access policies, WAF rules, and rollback procedures.

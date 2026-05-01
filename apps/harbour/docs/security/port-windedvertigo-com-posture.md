# port.windedvertigo.com — Security Posture & Deploy Health

**Date:** 2026-04-14 (revised)
**Scope:** Vercel project `wv-crm` (`prj_rlsjo62EFnVofPUyjt0eYgzcrjmC`) in team `ghandoffs-projects` (`team_wrpRda7ZzXdu7nKcEVVXY3th`), serving `port.windedvertigo.com`.

## TL;DR

- **Confirmed:** `wv-crm` is the Vercel project serving `port.windedvertigo.com`. 3 domains configured at the project level: `port.windedvertigo.com` (primary), `crm.windedvertigo.com` (308 redirect → port), and `wv-crm.vercel.app` (default).
- **Resolved (availability):** Production deploys were broken from 2026-04-10 through 2026-04-14. The site was serving stale code from deployment `dpl_Gd7R2Mw6kKnQBXkmrQbgK1iVSUGe` (2026-04-10). Now fixed — current live deployment is `dpl_3R11dv7Wtpd5WdUQYTPFviduBW6q` (READY).
- **Root cause (fixed):** Commit `1dffeba` added `crm/` to `.gitignore` to stop the parent monorepo from tracking the nested git repo. Since Vercel uses `.gitignore` for upload filtering, the entire `crm/` directory was excluded from the upload — the build server received a monorepo referencing a `crm` workspace that didn't exist on disk. Fix: a `.vercelignore` file was created that mirrors `.gitignore` without the `crm/` and `ops-dashboard/` exclusions. When `.vercelignore` exists, Vercel uses it exclusively and ignores `.gitignore`.
- **Remaining concerns:** DNS is unproxied (no WAF), preview deployment protection unclear, 52 env vars with secrets in preview/dev environments, dormant GitHub integration generates wasted build attempts.

## 1. Ownership and routing

| Attribute | Value |
|---|---|
| Vercel project | `wv-crm` (`prj_rlsjo62EFnVofPUyjt0eYgzcrjmC`) |
| Team | `ghandoffs-projects` (`team_wrpRda7ZzXdu7nKcEVVXY3th`) |
| Production branch | `main` |
| Git link | `ghandoff/wv-crm` (GitHub), `createDeployments: enabled` |
| Framework | Next.js (`nextjs`) |
| Root directory | `null` (repo root) |
| Build command | `npm run build` |
| Install command | `npm install` |
| Ignored build step | empty |
| Node | `24.x` |

**Project-level domains** (via `/v9/projects/.../domains`):

| Domain | Behaviour |
|---|---|
| `port.windedvertigo.com` | Primary — serves the app |
| `crm.windedvertigo.com` | 308 permanent redirect → `port.windedvertigo.com` |
| `wv-crm.vercel.app` | Default Vercel domain |

One project, one codebase, two entry points. `crm.windedvertigo.com` is a forwarding rule, not a separate app.

**Current live deployment:** `dpl_3R11dv7Wtpd5WdUQYTPFviduBW6q` (READY).

## 2. Deploy health (resolved)

Between 2026-04-10 and 2026-04-14, production deploys were stuck in a failure loop. Of the last 30 deployments prior to the fix, 29 were CANCELED and 1 was ERROR. All originated from `source: git`, `repo: windedvertigo` (the monorepo), not from `ghandoff/wv-crm`.

The site was serving deployment `dpl_Gd7R2Mw6kKnQBXkmrQbgK1iVSUGe` from 2026-04-10 (~4 days stale) until the fix landed.

**Root cause:** Commit `1dffeba` ("exclude nested repos from parent tracking, clear gitmodules") added `crm/` to the monorepo's `.gitignore`. Vercel's `vercel deploy` command respects `.gitignore` for upload filtering, so the entire `crm/` directory was excluded from the deployment upload. The build server received a monorepo whose `package.json` referenced a `crm` workspace that wasn't present on disk, producing:

```
npm error No workspaces found:
npm error   --workspace=crm
Error: Command "npm run build -w crm" exited with 1
```

Note: `package.json` still lists `crm` in its `workspaces` array — the workspace declaration was never removed. The directory simply wasn't uploaded.

**Fix applied:** A `.vercelignore` file was created at the monorepo root, mirroring `.gitignore` without the `crm/` and `ops-dashboard/` lines. When `.vercelignore` exists, Vercel uses it exclusively and ignores `.gitignore`. The CRM has been successfully redeployed.

## 3. Dormant GitHub integration (open — P1)

Two possible deploy paths exist:

1. **Vercel↔GitHub integration** (dormant but active). Connected to `ghandoff/wv-crm`, `createDeployments: enabled`. Pushes to `wv-crm` main trigger Vercel build attempts, but these fail because the standalone repo can't resolve the monorepo's shared packages. Every push generates a wasted build that immediately errors or cancels.
2. **CLI swap-script** (active, canonical). `windedvertigo/scripts/deploy-crm.sh` swaps `.vercel/project.json` at the monorepo root to target `wv-crm`, runs `vercel deploy --prod`, then restores. All successful production deploys go through this path.

**Recommendation:** Disable the GitHub integration on the `wv-crm` Vercel project (set `createDeployments` to `disabled` or disconnect the repo link). The CLI swap-script from the monorepo is the sole production deploy mechanism. Leaving the integration enabled wastes build minutes and creates noise in the deployment log.

## 4. Environment variable audit (open — P1)

52 env vars total. All stored as `encrypted` except one `plain` value (`AUTH_TRUST_HOST`, non-sensitive). **No values were retrieved — names only.** Grouped by concern:

**Secrets that exist in preview and/or development, not only production:**

- `CRON_SECRET` — in production, preview, and development
- `AUTH_SECRET` — in production, preview, and development
- `ANTHROPIC_API_KEY` — in production and development
- `GMAIL_REFRESH_TOKEN` — in production and development
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — in production and (preview, development)
- `BLUESKY_HANDLE` / `BLUESKY_APP_PASSWORD` — in production and (preview, development)
- `RESEND_WEBHOOK_SECRET` — in production and development
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — all three envs
- Plus every `RESEND_*`, `R2_*`, `CF_ACCOUNT_ID`, `NOTION_TOKEN` — all three envs

**Security implications:**

- Preview URLs are auto-posted as PR comments (`gitComments.onPullRequest: true`). Anyone who can see a PR link can reach that preview.
- If deployment protection on preview is *not* enforcing auth (see §5), those previews execute with production-adjacent secrets (`CRON_SECRET`, `AUTH_SECRET`, OAuth client secrets).
- Recommend: scope preview/development versions of `CRON_SECRET`, `AUTH_SECRET`, and OAuth client IDs/secrets to values that cannot authorize against production resources (separate Google OAuth client, separate Resend webhook, dedicated LinkedIn app, etc.).

**Production-only secrets (appropriately scoped):**

- `SLACK_*`, `GUSTO_*`, `INNGEST_*`, `FEEDLY_*`, `GOOGLE_SA_RFP_SCANNER`, `SUBSTACK_*`, `ADMIN_EMAILS`, `ALLOWED_EMAILS`, `AUTH_URL` — all production only. Good.

**Rotation hygiene:** the oldest secret was added 2026-03-24. We can't see *when values last rotated* — only when the env var row was created. Recommend annual rotation minimum for all OAuth client secrets, Gusto, Resend webhook, and R2 keys.

## 5. Deployment protection (open — P0)

| Setting | Value | Note |
|---|---|---|
| `ssoProtection` | `null` | No team SSO gate on deployments |
| `passwordProtection` | object present, `deploymentType: null` | Password field exists but `deploymentType` is `null`. **Unclear whether password protection is actually enforced** — needs manual verification in the UI. |
| `trustedIps` | not set | No IP allowlist |
| `gitForkProtection` | `true` | Forks can't auto-deploy ✓ |
| `gitComments.onPullRequest` | `true` | Preview URLs posted to PR comments |
| `skewProtectionMaxAge` | 43200 (12h) | Reasonable |

**Action item:** Log into Vercel → wv-crm → Settings → Deployment Protection and confirm whether preview deployments require authentication. If not, enable at least "Only Preview Deployments" password/SSO protection. This matters because preview environments have access to `CRON_SECRET`, `AUTH_SECRET`, and other production-adjacent secrets (see §4).

If `ghandoff/wv-crm` and `ghandoff/windedvertigo` are private on GitHub, preview URLs don't leak via PR comments since only collaborators see them. But if either becomes public or a collaborator account is compromised, previews become an exfil vector for the preview-env secrets.

## 6. DNS and Cloudflare (open — P2)

- `port.windedvertigo.com` response headers: `server: Vercel`, `x-vercel-id` present, **no `cf-ray`**. The DNS record is an **A record pointing to `76.76.21.21`** (Vercel's anycast IP), **DNS-only (grey cloud)** — not proxied by Cloudflare.
- Cloudflare account connected via MCP (`anotheroption@gmail.com`, `4f33ee381364bce6959bdea092f046bb`) has **zero Workers** deployed.
- The DNS zone sits on the `garrett@windedvertigo.com` Gearbox account. Nameservers: `lana.ns.cloudflare.com` + `ed.ns.cloudflare.com`.

**Implication:** All traffic to the CRM hits Vercel directly. No WAF, no Cloudflare bot protection, no rate limiting layer in front. Evaluate flipping to orange-cloud proxying once the deploy pipeline is confirmed stable. Vercel supports proxied Cloudflare records but requires domain verification via TXT record since the proxied record hides the target from Vercel's verification.

## 7. Prioritized action list

**P0 — verify this week:**

1. ~~Fix the deploy loop.~~ **Done.** `.vercelignore` fix deployed, site is READY at `dpl_3R11dv7Wtpd5WdUQYTPFviduBW6q`.
2. Confirm Deployment Protection state in the Vercel UI (Settings → Deployment Protection). If disabled, enable at least "Only Preview Deployments" = password/SSO.

**P1 — this week:**

3. Disable the dormant GitHub integration on `wv-crm`. Set `createDeployments` to `disabled` or disconnect the repo link. All production deploys go through the CLI swap-script from the monorepo.
4. Audit which of the 52 env vars are set for Preview/Development environments. Scope `CRON_SECRET`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and other sensitive keys to production-only, or create separate non-production values for lower environments.
5. Rotate any secrets that were shared between prod and lower environments.

**P2 — this month:**

6. Move `port.windedvertigo.com` to orange-cloud proxied, add Cloudflare WAF / rate-limit rules.
7. Add a GitHub Actions smoke test that asserts a successful Vercel deployment after merging to main.
8. Document the canonical deploy path (CLI swap-script from monorepo) in `docs/runbooks/`.

## 8. Corrections log

This report was revised on 2026-04-14 based on independent terminal verification. Changes from v1:

- **Domain discovery method:** v1 looked at deployment aliases; correct approach is the project-level domains endpoint (`/v9/projects/.../domains`). `crm.windedvertigo.com` is a 308 redirect, not a separate app.
- **Deployment date:** v1 reported `dpl_Gd7R2Mw` as 2026-03-24 (~3 weeks stale). Correct `createdAt` per API is 2026-04-10 (~4 days stale). Timestamp parsing error in v1.
- **Root cause:** v1 diagnosed "commit `1dffeba` removed `crm/` as an npm workspace." Incorrect — `package.json` still has `crm` in `workspaces`. The actual cause was `.gitignore` excluding `crm/` from Vercel's upload filter, so the workspace directory was absent on the build server despite being declared.
- **Fix mechanism:** `.vercelignore` (not workspace re-declaration or build flag changes). When `.vercelignore` exists, Vercel uses it exclusively and ignores `.gitignore`.

## 9. Data sources

- Vercel REST API v9/v6/v4/v3 (authenticated session), queried against `prj_rlsjo62EFnVofPUyjt0eYgzcrjmC` in `team_wrpRda7ZzXdu7nKcEVVXY3th`.
- Live HTTP response headers from `https://port.windedvertigo.com/` captured via Chrome DevTools network layer.
- Cloudflare MCP on account `4f33ee381364bce6959bdea092f046bb` — `workers_list` returned 0.
- Independent terminal verification by project owner (corrections in §8).
- Not accessed in this audit: the `windedvertigo.com` Cloudflare zone on the Gearbox account, the actual env var values, and the HTTP-layer WAF/rate-limit policies (none exist on this path).

# Cloudflare API token + GitHub secret setup

One-time setup so GitHub Actions can deploy CF Workers and Pages on your
behalf. Takes ~5 minutes. After this is done, deploys = one click in the
GitHub Actions UI (or one CLI command via `gh`).

## Step 1 — Create the Cloudflare API token

1. Open <https://dash.cloudflare.com/profile/api-tokens>.
2. Click **Create Token**.
3. Choose the **"Edit Cloudflare Workers"** template (closest preset to what we need). Click **Use template**.
4. Under **Permissions**, the template adds Workers Scripts + Account Settings + Workers Tail. Add these three more by clicking **Add more**:
   - **Account** → **Cloudflare Pages** → **Edit**   (lets it deploy values-auction SPA)
   - **Account** → **Workers KV Storage** → **Edit** (lets it set KV bindings during deploys)
   - **Account** → **D1** → **Edit**   (future-proofs if D1 bindings show up)
5. Under **Account Resources**, change "All accounts" to **Include → Specific account → garrett@windedvertigo.com**. (Locks the token to your CF account; if it leaks, only that account is exposed.)
6. Under **Zone Resources**, set **Include → Specific zone → windedvertigo.com**. (Needed for Workers Routes edits.)
7. Leave Client IP Address Filtering empty (GitHub-hosted runners have rotating IPs).
8. Set TTL to **1 year** unless you have a stricter policy. (Renewable.)
9. Click **Continue to summary** → **Create Token**.
10. **COPY the token** — it's shown exactly once. If you lose it, you can revoke it from the same page and create a new one.

## Step 2 — Find your Cloudflare Account ID

Already known: `097c92553b268f8360b74f625f6d980a`

(Source of truth: <https://dash.cloudflare.com> → right sidebar shows Account ID. Also documented in `CLAUDE.md`.)

## Step 3 — Add both to GitHub repo secrets

1. Open <https://github.com/ghandoff/windedvertigo/settings/secrets/actions>.
2. Click **New repository secret**.
3. Add the first secret:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Secret:** paste the token from Step 1
   - **Add secret**
4. Click **New repository secret** again.
5. Add the second secret:
   - **Name:** `CLOUDFLARE_ACCOUNT_ID`
   - **Secret:** `097c92553b268f8360b74f625f6d980a`
   - **Add secret**

Both secrets are now available to the `.github/workflows/deploy.yml` workflow.

## Step 4 — Trigger the first deploy to verify wiring

Pick one path.

### From the GitHub web UI

1. <https://github.com/ghandoff/windedvertigo/actions/workflows/deploy.yml>
2. Click **Run workflow** (top right).
3. **Branch:** `claude/remove-vercel-migrate-cloudflare-omCpK` (or `main` once merged).
4. **Target:** `site`
5. Click **Run workflow**.
6. Watch the run. The smoke-test step at the end will fail loudly if the deploy doesn't take.

### From your terminal (requires `gh` CLI)

```sh
gh workflow run deploy.yml -f target=site
gh run watch    # follow the run live
```

## Common targets

| Target value | What gets deployed |
|---|---|
| `site` | `wv-site` worker (the main windedvertigo.com proxy) |
| `rubric-co-builder` | `wv-harbour-rubric-co-builder` worker |
| `values-auction-pages` | SPA build pushed to CF Pages project `values-auction` |
| `all` | All three above, sequentially |

## Troubleshooting

**Run fails at "Deploy wv-site" with `Authentication error [code: 10000]`**
The API token doesn't have the right scopes. Go back to the CF dashboard, edit the token, ensure all 6 permissions from Step 1.4 are present.

**Run fails at "Deploy values-auction SPA" with `pages_project_not_found`**
The Pages project name in `apps/harbour/values-auction/package.json` (`deploy:spa` script, `--project-name values-auction`) doesn't match what's actually in your CF account. Check the Pages section of the CF dashboard and match it.

**Run fails at "Smoke test" but deploy succeeded**
Smoke test runs from a GitHub-hosted runner; the deploy is already live. The smoke failure means a route's broken in production. Paste the failing URL back into the conversation here; we diagnose from there.

## Cost

GitHub Actions on Ubuntu runners: **2 minutes per deploy**. Free tier on
private repos is 2,000 minutes/month → 1,000 deploys/month free. You won't
hit this unless you're deploying 30+ times a day.

## Revoking the token

If you ever suspect the token has leaked: go back to the CF API tokens
page, find the token by name, click the three-dot menu → **Roll** (creates
a new value, invalidates the old one) or **Delete** (revokes entirely).
Update the GitHub secret with the new value if you rolled.

# claude code prompt: vercel migration audit + cleanup

> paste this into a Claude Code conversation with the windedvertigo monorepo mounted. run this BEFORE deleting any more vercel projects.

---

we're migrating everything off vercel onto cloudflare workers. i need you to audit every CF worker deployment to make sure it's actually live and serving correctly before we delete the corresponding vercel projects.

## context

we've already deleted these vercel projects today:
- **windedvertigo** (was the main site) → should now be served by CF worker `wv-site` at windedvertigo.com
- **wv-ancestry** → should now be served by CF worker `wv-ancestry` at ancestry.windedvertigo.com

we have NOT yet deleted these vercel projects, but want to:
- **wv-ops** → CF worker `wv-ops` exists, domain ops.windedvertigo.com (vercel shows "DNS Change Recommended" = proxy detected)
- **nordic-sqr-rct** → CF worker `wv-nordic` exists, domain nordic.windedvertigo.com (vercel shows "Invalid Configuration" = DNS moved)
- **vertigo-vault** → CF worker `wv-vault` exists, only has vertigo-vault.vercel.app (no custom domain)

one project still needs DNS cutover before deletion:
- **creaseworks** → CF worker `wv-harbour-creaseworks` exists, but creaseworks.windedvertigo.com DNS still points at vercel ("Valid Configuration")

## what i need you to do

### phase 1: verify already-deleted projects
1. curl windedvertigo.com and confirm it loads (check HTTP status, look for our content)
2. curl ancestry.windedvertigo.com and confirm it loads
3. check the wrangler.toml configs for both to understand their routes and bindings
4. report any issues — if either is broken, that's urgent

### phase 2: verify candidates for deletion
for each of wv-ops, wv-nordic, and wv-vault:
1. find and read the wrangler.toml (or wrangler.jsonc) config in the monorepo
2. check what routes/domains are configured
3. curl the production URL and verify the CF worker responds correctly
4. check the deploy script if one exists (scripts/deploy-*.sh)
5. compare environment variables: what's in the wrangler config vs what vercel has (the vercel projects have 5-6 env vars each — we need to make sure those are set as CF worker secrets)
6. report: is this worker fully ready to be the sole host? yes/no and why

### phase 3: creaseworks DNS cutover plan
1. read the wrangler config for wv-harbour-creaseworks
2. check what DNS record currently exists for creaseworks.windedvertigo.com in our cloudflare zone
3. determine exactly what needs to change to point creaseworks.windedvertigo.com at the CF worker instead of vercel
4. write out the exact steps (but don't execute — i want to review first)

### phase 4: summary
give me a clear table:

| service | CF worker | domain | status | safe to delete vercel? |
|---------|-----------|--------|--------|----------------------|

and list any blockers or risks.

## important notes
- our cloudflare account id is `097c92553b268f8360b74f625f6d980a`
- all workers use OpenNext (next.js on CF workers)
- the monorepo is at the root of this repo — apps live in subdirectories (harbour/, ancestry/, ops/, etc.)
- don't delete anything — this is audit only
- if you find broken deployments, flag them immediately so we can fix before the next billing cycle

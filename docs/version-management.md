# Version Management — windedvertigo Monorepo

> Last audited: 2026-03-11
> Next scheduled audit: 2026-04-11 (monthly)

This document is the single source of truth for all dependency versions, update procedures, and automation across the monorepo. It covers npm packages, global CLIs, MCP servers, and platform services.

---

## 1. Version Registry

### 1a. Runtime & Build

| Dependency | Current | Target | Pinned via | Used by | Tier | Constraint |
|------------|---------|--------|------------|---------|------|------------|
| Node.js | 25.6.0 (local) / 20 (CI) | **22 LTS** | `.nvmrc`, `engines` | all | P4 | Standardize on 22 LTS |
| npm | 11.8.0 | 11.x | `packageManager` field | root | P4 | — |
| Turborepo | 2.8.13 | ^2 | root devDeps | all | P3 | — |

### 1b. Frameworks

| Dependency | Current | Used by | Tier | Constraint |
|------------|---------|---------|------|------------|
| next | 16.1.6 | creaseworks, deep-deck, harbour, sqr-rct, vault | P1 | All apps should pin same major |
| react | 19.2.3 | creaseworks, deep-deck, harbour, sqr-rct, vault | P1 | Tied to Next.js compatibility |
| react-dom | 19.2.3 | creaseworks, deep-deck, harbour, sqr-rct, vault | P1 | Tied to React |
| tailwindcss | ^4.0.0 | creaseworks, deep-deck, harbour, vault | P1 | — |
| tailwindcss | ^3.4.3 | **sqr-rct only** | P1 | **Needs v3→v4 migration (not a simple bump)** |
| next-auth | 5.0.0-beta.30 | creaseworks, vault | P1 | **HOLD — wait for v5 stable release** |
| @auth/core | ^0.41.0 | creaseworks, vault | P1 | Tied to next-auth |

### 1c. SDKs & APIs

| Dependency | Current | Latest | Used by | Tier | Constraint |
|------------|---------|--------|---------|------|------------|
| @anthropic-ai/sdk | **0.39.0** | 0.78.0 | pocket.prompts | P2 | **OUTDATED — test voice pipeline before bumping** |
| @anthropic-ai/sdk | 0.73.0 | 0.78.0 | sqr-rct | P2 | — |
| @notionhq/client | 2.3.0 | 5.12.0 | root, creaseworks, pocket.prompts | P2 | Major version jump — evaluate breaking changes |
| @notionhq/client | 2.2.15 | 5.12.0 | sqr-rct | P2 | Align to 2.3.0 first, then evaluate v5 |
| stripe | ^17.7.0 | — | creaseworks, vault | P2 | — |
| @slack/web-api | ^7.9.1 | — | pocket.prompts | P2 | — |
| @aws-sdk/client-s3 | 3.998.0 | 3.1007.0 | creaseworks | P2 | Auto-updateable (patch) |
| @aws-sdk/s3-request-presigner | 3.998.0 | 3.1007.0 | creaseworks | P2 | Keep in sync with client-s3 |
| resend | ^6.9.2 | — | creaseworks, vault | P2 | — |
| openai | 6.25.0 | 6.27.0 | sqr-rct | P2 | — |
| @vercel/postgres | ^0.10.0 | — | creaseworks, vault | P2 | — |
| @vercel/kv | ^3.0.0 | — | pocket.prompts | P2 | — |
| @vercel/blob | ^2.2.0 | — | sqr-rct | P2 | — |

### 1d. Dev Tools

| Dependency | Current | Used by | Tier |
|------------|---------|---------|------|
| typescript | ^5 | creaseworks, deep-deck, harbour, vault | P3 |
| eslint | 9.39.3 | all Next.js apps | P3 |
| eslint-config-next | ^16.1.6 | all Next.js apps | P3 |
| vitest | ^4.0.18 | creaseworks | P3 |
| @tailwindcss/postcss | ^4.0.0 | creaseworks, deep-deck, harbour, vault | P3 |

### 1e. Global CLIs

| CLI | Current | Install method | Tier |
|-----|---------|----------------|------|
| vercel | 50.27.0 | `npm i -g vercel` | P3 |
| stripe | 1.37.2 | `brew install stripe/stripe-cli/stripe` | P3 |
| wrangler | 4.72.0 | `npm i -g wrangler` | P3 |
| neonctl | 2.21.2 | `npm i -g neonctl` | P3 |
| turbo | 2.8.13 | `npm i -g turbo` | P3 |
| gh | 2.86.0 | `brew install gh` | P3 |
| op | 2.32.1 | `brew install --cask 1password-cli` | P3 |
| claude | 2.1.61 | `claude update` | P3 |

### 1f. MCP Servers

| Server | Transport | URL | Update model |
|--------|-----------|-----|-------------|
| Neon | HTTP (remote) | `https://mcp.neon.tech/mcp` | Auto — server-side |
| Stripe | HTTP (remote) | `https://mcp.stripe.com` | Auto — server-side |
| GitHub | HTTP (remote) | `https://api.githubcopilot.com/mcp/` | Auto — server-side |
| Cloudflare | claude.ai connector | — | Auto — managed by Anthropic |
| Notion | claude.ai connector | — | Auto — managed by Anthropic |
| Vercel | claude.ai connector | — | Auto — managed by Anthropic |
| Gmail | claude.ai connector | — | Auto — managed by Anthropic |
| Google Calendar | claude.ai connector | — | Auto — managed by Anthropic |
| Miro | claude.ai connector | — | Auto — managed by Anthropic |

> MCP servers using remote HTTP transport auto-update server-side. No local action needed. Verify connectivity with `/mcp` in Claude Code if issues arise.

### 1g. Platforms

| Platform | Purpose | How to check version/status |
|----------|---------|----------------------------|
| Vercel | Hosting + serverless | `vercel --version`, dashboard |
| Neon | Postgres | `neonctl --version`, console.neon.tech |
| Stripe | Payments | `stripe --version`, dashboard.stripe.com |
| Cloudflare | R2, Workers, D1 | `wrangler --version`, dash.cloudflare.com |
| GitHub | Source, CI/CD | `gh --version`, github.com settings |
| Notion | CMS, databases | API via @notionhq/client |
| 1Password | Secrets | `op --version` |

---

## 2. Update Cadence Tiers

| Tier | Scope | Cadence | Examples |
|------|-------|---------|----------|
| **P0 — Security** | CVEs, `npm audit` critical/high | **Immediate** (same day) | Known exploits, auth bypasses |
| **P1 — Frameworks** | Next.js, React, Tailwind, Auth.js | **Monthly** evaluation | Major/minor releases, breaking changes |
| **P2 — SDKs** | Anthropic, Stripe, Notion, AWS, Resend | **Quarterly** | API changes, new features |
| **P3 — Tooling** | CLIs, ESLint, TypeScript, Vitest | **Quarterly** | DX improvements, new rules |
| **P4 — Platforms** | Node.js, npm, Vercel platform | **As-needed** | LTS transitions, EOL warnings |

---

## 3. Update Procedures

### 3a. Pre-flight (always do this first)

```bash
# 1. Clean working tree
git status  # must be clean or stash first

# 2. Create update branch
git checkout -b chore/deps-update-YYYY-MM

# 3. Pull latest
git pull --rebase origin main
```

### 3b. npm packages

```bash
# Check what's outdated
npm outdated

# Security audit
npm audit

# Interactive update (respects semver ranges)
npx npm-check-updates --interactive --root --workspace

# Or update a specific package across all workspaces
npm update @anthropic-ai/sdk --workspace=apps/pocket.prompts
```

### 3c. Global CLIs

```bash
# npm-installed CLIs
npm update -g vercel wrangler neonctl turbo

# Homebrew CLIs
brew upgrade stripe gh

# 1Password CLI
brew upgrade --cask 1password-cli

# Claude Code
claude update
```

### 3d. Post-update verification

```bash
# 1. Install fresh
npm ci

# 2. Type-check all apps
turbo typecheck

# 3. Lint all apps
turbo lint

# 4. Run tests
turbo test

# 5. Build all apps
turbo build

# 6. Spot-check dev servers
npm run dev:creaseworks  # verify renders
npm run dev:vault        # verify renders
```

### 3e. Rollback

```bash
# Undo package changes
git checkout -- package.json package-lock.json apps/*/package.json
npm ci

# Or reset the branch entirely
git checkout main
git branch -D chore/deps-update-YYYY-MM
```

---

## 4. Monthly Audit Checklist

Copy this checklist at the start of each monthly audit:

```markdown
### Monthly Dependency Audit — YYYY-MM-DD

**Security**
- [ ] `npm audit` — resolve critical and high findings
- [ ] Check GitHub security advisories for the repo

**Packages**
- [ ] `npm outdated` — review all outdated packages
- [ ] Update P0 (security) immediately
- [ ] Evaluate P1 (frameworks) for update
- [ ] Note P2/P3 for quarterly batch

**CLIs**
- [ ] `vercel --version` vs latest
- [ ] `stripe --version` vs latest
- [ ] `wrangler --version` vs latest
- [ ] `neonctl --version` vs latest
- [ ] `turbo --version` vs latest
- [ ] `gh --version` vs latest
- [ ] `op --version` vs latest
- [ ] `claude --version` vs latest

**MCP Servers**
- [ ] Run `/mcp` in Claude Code — verify all servers connect
- [ ] Re-auth any that have expired OAuth tokens

**Verification**
- [ ] `turbo build` passes
- [ ] `turbo typecheck` passes
- [ ] `turbo test` passes
- [ ] Deploy a preview branch to Vercel

**Documentation**
- [ ] Update version numbers in this file
- [ ] Update `Last audited` date at the top
```

### Decision framework: "Should I update this?"

```
Is it a security fix (CVE, npm audit critical/high)?
  → YES: Update immediately on all apps.

Is it a major version bump?
  → Check the changelog for breaking changes.
  → If breaking: create a dedicated branch, update one app first, test thoroughly.
  → If non-breaking: batch with other updates.

Does it affect multiple apps?
  → YES: Update all apps together to avoid version drift.
  → Test each app's build and dev server after updating.

Is it a beta/pre-release?
  → Generally HOLD unless you need a specific fix.
  → Exception: next-auth v5 beta is already in use — stay on current beta, don't downgrade.

Is it a CLI or MCP server?
  → CLIs: update quarterly, verify with --version.
  → MCP servers (remote HTTP): auto-update server-side, no action needed.
```

---

## 5. Known Constraints & Pinned Versions

| Dependency | Constraint | Reason |
|------------|-----------|--------|
| next-auth | **Hold at 5.0.0-beta.30** | Waiting for v5 stable. Do NOT downgrade to v4. Do NOT blindly bump beta. |
| @anthropic-ai/sdk (pocket.prompts) | **Test voice pipeline before bumping** | pocket.prompts uses opus-4-6 intent detection. SDK changes can break prompt format or streaming. Run full voice→intent→action→TTS cycle. |
| @notionhq/client | **Hold at ^2.3.0** | v5.x is a major rewrite. Evaluate breaking changes before migrating. |
| tailwindcss (sqr-rct) | **v3→v4 requires migration** | Not a simple version bump. Needs config rewrite, class name changes. Separate task. |
| Node.js | **Standardizing on 22 LTS** | `.nvmrc` pins 22. CI workflows updated. Local may still run 25 — `nvm use` before dev work. |
| @auth/core | **Tied to next-auth** | Don't update independently. Updates come through next-auth. |

---

## 6. Automation

### Renovate (automated dependency PRs)

Configured in `.github/renovate.json`. Renovate will:
- Open grouped PRs weekly (Monday mornings)
- Automerge patch updates after CI passes
- Group updates by category (frameworks, SDKs, tooling)
- Pin GitHub Actions versions for security
- Run lockfile maintenance weekly

### .nvmrc

Repo root contains `.nvmrc` pinning Node 22 LTS. Run `nvm use` when switching to this project.

### engines field

Root `package.json` contains `"engines": { "node": ">=22" }` to warn if running an incompatible Node version.

### CI

Both `.github/workflows/ci.yml` and `.github/workflows/sync-notion.yml` use Node 22.

---

## 7. Current Audit Findings (2026-03-11)

These issues exist today and should be addressed:

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | `@anthropic-ai/sdk` 0.39.0 in pocket.prompts (latest: 0.78.0) | Medium | Update + test voice pipeline |
| 2 | `@notionhq/client` 2.2.15 in sqr-rct (others: 2.3.0) | Low | Align to 2.3.0 |
| 3 | `tailwindcss` v3 in sqr-rct (others: v4) | Low | Separate migration task |
| 4 | `@aws-sdk/*` 3.998.0 (latest: 3.1007.0) | Low | Patch update, safe to bump |
| 5 | `npm audit`: 6 high, 8 moderate vulnerabilities | Medium | Run `npm audit fix` |
| 6 | Node 20 in CI vs 25 local | Medium | Standardize on 22 LTS (in progress) |

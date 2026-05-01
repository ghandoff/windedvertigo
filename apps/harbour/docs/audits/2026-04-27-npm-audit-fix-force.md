# npm audit fix --force — finding (2026-04-27)

**Outcome:** `npm audit fix --force` is **NOT viable** for this monorepo. Do not run it again without first updating advisory-resolution overrides.

## Pre-state

- Vulnerabilities: 18 total (1 high, 17 moderate, 0 critical)
- next-auth: `5.0.0-beta.30` across all 22 workspaces (intentional pin)
- @notionhq/client v2 in: creaseworks, vertigo-vault, paper-trail, raft-house, tidal-pool, packages/notion-adapter, root (intentional — not yet migrated to CF Workers)
- @notionhq/client v5 in: harbour (already on CF Workers via notion-adapter)
- `tsc --noEmit` clean on creaseworks, vertigo-vault, depth-chart, harbour, paper-trail, raft-house, tidal-pool
- creaseworks tests: 126/126 pass

## What --force did

`npm audit fix --force` rewrote `package.json` in 28 workspaces and produced **catastrophic downgrades**:

| Package | Before | --force result | Impact |
|---|---|---|---|
| next | ^16.2.3 | ^9.3.3 | Next.js 9 is from 2020. Would break the entire monorepo. |
| next-auth | ^5.0.0-beta.30 | ^3.29.10 | Violates intentional pin. v3 → v5 is a complete API rewrite. |
| @vercel/analytics | (only added where missing) | 1.1.4 | Pinned to old version |
| vite | (not previously direct dep) | 8.0.10 | vite 8 does not exist; 7.x is current |
| partykit | (not previously direct dep) | 0.0.0 | Bogus version pin |
| vitest | ^4.0.18 | 4.1.5 | Demoted from caret to exact |
| wrangler | ^4.81.1 | 4.85.0 | Demoted from caret to exact |
| resend | ^6.9.2 | ^6.1.3 | Downgrade |
| @opennextjs/cloudflare | ^1.19.1 | ^1.14.1 / 1.14.1 | Downgrade |

`packages/auth/package.json` was given new bogus dependencies (vite, partykit, vitest, wrangler, @vercel/analytics) it has no business owning.

**Post-`--force` vuln count: 110 (5 critical, 28 high, 62 moderate, 15 low)** — the "fix" introduced 92 new vulnerabilities by pinning to ancient versions of next-auth, next, vite, etc., that themselves have well-known CVEs.

## Root cause

`--force` reads each top-level advisory and aggressively tries to satisfy it via the *oldest non-vulnerable version* of the affected package, ignoring our actual upgrade trajectory. For Next.js 16 → next-auth v5 beta stacks, that resolver picks v9-era versions because the advisory chain's "fixed in" data extends back into archived majors. The pin `^5.0.0-beta.30` is incompatible with `--force`'s greedy backsolver.

## Per-workspace validation (baseline preserved)

After reverting `--force`'s changes:

| Workspace | tsc --noEmit | Notes |
|---|---|---|
| creaseworks | clean | 126/126 tests pass |
| vertigo-vault | clean | |
| depth-chart | clean | |
| harbour | clean | |
| paper-trail | clean | |
| raft-house | clean | |
| tidal-pool | clean | |

## Recommendation

1. **Do not run `--force` until** `package.json` files in all workspaces include `overrides` (or the root has `overrides`) for next-auth, next, vite, @opennextjs/cloudflare, resend, vitest, and wrangler — pinning each to its current major. That gives the resolver no room to downgrade.
2. The 18 baseline vulnerabilities are predominantly transitive (cookie, esbuild, path-to-regexp via legacy aws-sdk + miniflare chains). Many require waiting on upstream maintainer releases.
3. Address the 1 high-severity vuln via a targeted, manually-resolved override PR — not via `--force`.

## Branch

This branch (`chore/security-fix-force-2026-04-27`) intentionally contains only this audit log. **No code changes were applied.** Do not merge as a fix; it is a finding/report PR.

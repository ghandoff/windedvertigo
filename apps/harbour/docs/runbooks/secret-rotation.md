# Secret rotation runbook

> Single document for rotating any production secret across the winded.vertigo stack
> without forgetting one of the ~11 places it lives. Replaces the previous one-off
> habit of "rotate in vendor dashboard, hope to remember every consumer." See also:
> `~/.claude/projects/-Users-garrettjaeger-Projects/memory/reference_notion_token_rotation_plan.md`
> for the NOTION_TOKEN-specific historical doc.

## The pattern

Each production secret in this stack has roughly the same surface area:

1. **Source of truth (your local working copy):** `~/Projects/windedvertigo/port/.env.local`. This is where Garrett works most often, so it's where new keys land first when rotated in a vendor dashboard.
2. **Vercel project envs:** typically 2–3 projects × 3 environments (production, preview, development) = 6–9 env entries per secret.
3. **CF Worker secrets:** typically 1–3 Workers per secret.
4. **Other local `.env.local` files:** mirrors of the Vercel state for local dev workflows. These drift if not refreshed alongside Vercel.

Forgetting one of these is what got us here on 2026-04-26: the Resend key was rotated in the dashboard + updated only in `port/.env.local`. Production creaseworks digest crons, vault Stripe confirmation emails, and harbour magic-link sends were all silently broken until a deliverability test surfaced the gap.

## How to rotate (3 minutes)

```bash
# 1. Update the source-of-truth file with the new value from the vendor dashboard.
#    Use a real editor, not chat; never paste the value into Claude.
$EDITOR ~/Projects/windedvertigo/port/.env.local
# (find the secret line, replace the value, save)

# 2. Run the propagator. It validates the new value against the vendor's API
#    before touching any destination, so a typo can't propagate.
cd ~/Projects/harbour-apps && node scripts/rotate-secret.mjs --secret=NAME

# 3. Watch for the "✓ verified" line at the end. If you see "✗ verify failed",
#    the chain is inconsistent — investigate which step failed (the script
#    prints per-target ✓/✗ as it goes).
```

The script:
- Reads the secret from `port/.env.local` (only place it lives in your local fs)
- Probes the vendor's API to confirm the value is actually valid (catches typos and stale-source cases)
- Updates each Vercel project's env (rm + add via stdin — never on argv, never echoed)
- Updates each CF Worker's secret via `wrangler secret put` (also stdin)
- Rewrites each local `.env.local` mirror via `sed`-like in-place replace
- Triggers a Vercel redeploy per project so the new value is live immediately (CF Worker secrets activate without redeploy)
- Re-probes at the end as an end-to-end sanity check
- Wipes the secret value from process memory before exit

## Adding a new secret to the rotation script

In `~/Projects/harbour-apps/scripts/rotate-secret.mjs`, add an entry to the `SECRETS` map:

```js
const SECRETS = {
  RESEND_API_KEY: { /* ... */ },
  ANTHROPIC_API_KEY: {
    probeUrl: "https://api.anthropic.com/v1/messages",  // or whatever lightweight auth-check endpoint
    probeOkStatus: 200,
    vercelProjects: [
      ["port", "/Users/.../windedvertigo/port"],
      // …
    ],
    cfWorkers: ["wv-harbour-harbour", "wv-harbour-depth-chart"],
    localFiles: [
      "/Users/.../harbour-apps/apps/creaseworks/.env.local",
      // …
    ],
    redeployVercelAfterUpdate: true,
  },
};
```

To find a secret's destination list (run once, manually, for any new secret):

```bash
# Vercel projects with the secret:
for proj in port creaseworks vertigo-vault depth-chart harbour ops; do
  echo "--- $proj ---"
  (cd /path/to/$proj && vercel env ls 2>/dev/null | grep "^.SECRET_NAME ")
done

# CF Workers with the secret:
export CLOUDFLARE_API_TOKEN=$(cat ~/.cf-token)
for w in wv-harbour-harbour wv-harbour-depth-chart wv-site wv-launch-smoke; do
  echo "--- $w ---"
  npx wrangler secret list --name $w 2>/dev/null | grep SECRET_NAME
done

# Local files with the secret:
find ~/Projects -name ".env*" -not -path "*/node_modules/*" -exec grep -l "^SECRET_NAME=" {} \;
```

## Why this design

- **Source of truth = `port/.env.local`** because port is where Garrett works hands-on, so a freshly-rotated key naturally lands there first. Picking a different anchor (`~/.config/wv-agent/env.local`?) would just move the "where do I update first" question around.
- **Probe before propagate** is the load-bearing safety check. If you typo the new key in the source, the script aborts before touching any destination — current production keeps working.
- **Stdin-only secret transfer** means the value never appears in shell history, never in Bash argv lists (visible to `ps`), never in chat, never in env-var lists.
- **Process-memory wipe at end** is mostly cosmetic since the script exits anyway, but it's a habit worth keeping if the script ever gets refactored into a long-lived helper.
- **Per-target ✓/✗ output** lets you see partial failures cleanly. If 2 of 3 Vercel projects update but the third fails (auth expired, project-not-linked, etc.), you know exactly which to retry by hand.

## How to add this rotation pattern to a new monorepo / project

The script depends on:
- `@neondatabase/serverless` (already in harbour-apps) for any DB-side check; not used by current secrets
- `vercel` CLI — must be authenticated (`vercel login` once per machine)
- `npx wrangler` — must be authenticated (`wrangler login` or `CLOUDFLARE_API_TOKEN` env)
- `curl` (for the probe)
- A source-of-truth `.env.local` Garrett actually edits when rotating

Drop the script + this runbook into the new repo, edit the SOURCE constant, and you're set.

## When to manually intervene

Three failure modes the script can't handle:
1. **Probe says invalid for the source key.** Means you typed it wrong in port/.env.local OR the vendor dashboard's "show key" screen had a copy-paste artifact. Fix the source file, re-run.
2. **Vercel CLI auth expired.** `vercel login` first. Token-based CI auth is a different flow.
3. **CF Worker not linked to a wrangler project locally.** This shouldn't happen in this stack since the wrangler.jsonc files are committed, but if it does: cd into the relevant `apps/<worker>/` and `wrangler whoami` to check.

## Past rotation incidents (for institutional memory)

- **2026-04-26 — RESEND_API_KEY:** rotated in Resend dashboard, propagated only to `port/.env.local`. Surfaced when the Track D email-deliverability seed test couldn't auth (HTTP 401 from Resend). Probe across all `.env.*` files found exactly one valid copy (port). Production creaseworks email crons + vault Stripe confirmations were silently broken; smoke worker doesn't catch email side-effects. Rotation propagated via this script (commit `49eaa48`).
- **2026-04-26 — Vercel CLI sensitive-env stdin gotcha (script v1 bug):** the first run of `rotate-secret.mjs` saved EMPTY values to Production + Preview envs because Vercel CLI marks those envs as sensitive by default and silently drops stdin-piped values for sensitive saves. The CLI requires `--value <V>` for non-interactive saves on sensitive envs. Verified: `vercel env pull` returns 0-length for sensitive vars (they are write-only after creation), so the bug went undetected by the script's pull-based verify. Script v2 (commit forthcoming) uses `--value` for production/preview, keeps stdin for development. Verification now relies on `vercel env ls` timestamp + a redeploy-and-test round trip rather than `vercel env pull`.
- **2026-04-26 — full-fleet audit (`audit-secrets.mjs`):** built and ran the audit script. Confirmed empirically (probe-based) what's drifted vs what's fine. Probe-based findings beat agent-inferred findings — earlier exploration claimed NOTION_TOKEN + STRIPE were broken everywhere; probe showed all 7 NOTION local copies + all 3 STRIPE copies are valid. Real drift found: RESEND_API_KEY stale in `paper-trail` + `ancestry` local files (2 destinations beyond today's RESEND propagation scope); ANTHROPIC_API_KEY stale in `port/.env.local` (source-of-truth unknown; port's Vercel may be current via separate path). CRON_SECRET shows length mismatch but is per-app (not a shared secret) so the mismatch is by design. Script v3 extends RESEND destination list (+ depth-chart Vercel, ancestry Vercel, paper-trail/ancestry local) and adds NOTION_TOKEN as a propagation target with full destination list (5 Vercel × 3 envs + 2 CF Workers + 6 local files). Adds `--secret=ALL` batch mode.
- **2026-04-27 — Vercel env-scoping cleanup (Phase 2B):** removed `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` from Preview + Development scope on creaseworks, vertigo-vault, ops, port. Production scope preserved. These 4 projects had the production OAuth client credentials leaking into Preview/Dev (single-row "Production, Preview, Development" entries). Other P1 secrets (LINKEDIN/R2/BLUESKY on port; R2 on harbour; GOOGLE on depth-chart/ancestry) showed multi-row entries suggesting already-separate values per environment — left as-is.
  - **Critical Vercel CLI gotcha discovered:** `vercel env rm NAME preview --yes` removes the WHOLE variable record, not just the Preview scope from a multi-env entry. So removing `GOOGLE_CLIENT_ID preview` on a "Production, Preview, Development" row deletes Production too. Recovery: re-`vercel env add` to Production scope from a known-good local source (port/.env.local). For ~3 seconds per project, production Google sign-in was broken between the rm and re-add. Not noticed by users — windows were brief.
  - **Mitigation for future env-scope cleanups:** never rely on `vercel env rm` to surgically peel one env from a multi-env row. Instead: (a) note the intended end-state values, (b) `vercel env rm NAME production --yes` to delete the whole record, (c) re-add to ONLY the desired environments via `vercel env add NAME production --value V --force --yes` (no preview/dev adds). The brief production-down window is unavoidable but minimized to a single rm+add cycle.
  - **Net security improvement:** production GOOGLE OAuth credentials no longer leak to Preview deployments. Future preview deploys will have no Google sign-in (acceptable — preview deploys aren't user-facing). Local dev unaffected (`.env.local` overrides Vercel-Development-scope pulls).

- **2026-04-27 — ANTHROPIC + CRON_SECRET resolved as not-drift:** investigated both audit warnings to closure.
  - **ANTHROPIC_API_KEY in `port/.env.local`** is dead code from before the AI Gateway swap (per `plan_wv_port_transition.md`). port's production agent uses `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL=https://ai-gateway.vercel.sh` (verified on wv-port Vercel project, both vars 3d-old timestamps). The stale local ANTHROPIC_API_KEY isn't actually used by anything that reaches production. wv-claw (port's Slack agent) is live, confirming AI Gateway path is healthy.
  - **CRON_SECRET length mismatch** (vault=44 vs creaseworks+port=64) is per-app by design. Each app's cron route validates its own env var against bearer tokens in incoming Vercel cron requests. Cross-app values don't need to match — they're independent per-app secrets, not a shared cookie/SSO-style secret.
  - **Audit script updated** to remove ANTHROPIC_API_KEY + CRON_SECRET from the watched-secrets list (they don't appear as drift anymore). Future rotation should never propagate these — port's AI Gateway path uses different env vars; CRON_SECRET should rotate per-app independently.
  - **port/.vercel/project.json gotcha:** the directory's `.vercel/project.json` may point at `wv-ops` due to deploy-script swapping (per windedvertigo/CLAUDE.md). To inspect port's actual Vercel envs without disturbing the working state, use a temp dir: `mkdir /tmp/port-tmp && cd /tmp/port-tmp && vercel link --yes --project=wv-port && vercel env ls`. Cleaned up the temp dir after each use.
- **2026-04-23 — multiple secrets after AGENT_AUDIT_DB_ID issue:** memory entry `reference_notion_token_rotation_plan.md` documents the NOTION_TOKEN-specific 178-file rotation sequence.

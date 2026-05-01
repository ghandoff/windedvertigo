# Auth-Pool Audit — 2026-04-25

> Phase 1.2 deliverable from the harbour-launch-readiness plan
> (`~/.claude/plans/partitioned-painting-pascal.md`).

## Headline finding

**Three independent auth pools exist, not one shared SSO**. The launch
plan's original probe matrix assumed "sign in at port, visit depth-chart
→ still authenticated." That isn't how the cookies are configured today,
and it isn't supposed to be. Below documents what each pool actually does,
why, and what the launch-readiness implications are.

## The three pools

### Pool A — harbour apps (domain-scoped on `.windedvertigo.com`)

**Implementation:** `harbour-apps/packages/auth/cookies.ts`
+ `harbour-apps/packages/auth/config.ts` via `createHarbourAuth({ appName })`.

**Apps in pool today:**
- `creaseworks` (live, `apps/creaseworks/src/lib/auth.ts`)
- `vertigo-vault` (live, `apps/vertigo-vault/lib/auth.ts`)
- `depth-chart` (live as of 2026-04-25 migration, `apps/depth-chart/lib/auth.ts`)

**Apps to add at launch (Phase 3 of launch plan):**
- `harbour` hub itself

**Cookie shape (production):**

| field | value |
| --- | --- |
| name | `authjs.session-token` |
| domain | `.windedvertigo.com` |
| path | `/` |
| secure | true |
| httpOnly | true |
| sameSite | lax |
| session.maxAge | 7 days |

Apps in this pool can read each other's session cookies because the
domain is set to the parent `.windedvertigo.com`. They share the same
`AUTH_SECRET` so the JWT is verifiable across hosts.

### Pool B — port (host-scoped on `port.windedvertigo.com`)

**Implementation:** `windedvertigo/packages/auth/index.ts`
(re-exported via `port/lib/shared/auth/index.ts` and consumed as
`@/lib/shared/auth`).

**Cookie shape (production):**

| field | value |
| --- | --- |
| name | `__Secure-authjs.session-token` |
| domain | (unset → host-only) |
| path | `/` |
| secure | true |
| httpOnly | true |
| sameSite | lax |
| session.maxAge | 90 days |

**Why different:** port is the internal CRM/operational hub for w.v
collective members. It pre-dates the harbour-side shared package and uses
Auth.js v5's secure-prefix convention. The `__Secure-` prefix triggers
strict cookie rules in browsers (must be sent only over HTTPS, only from
the host that set it). Without `domain` it's host-only — `port.…` cookies
do not leak to `.windedvertigo.com`.

### Pool C — ops (host-scoped on `ops.windedvertigo.com`)

**Implementation:** Identical to Pool B — `ops/lib/auth.ts` re-exports
from `@windedvertigo/auth` which is the same workspace package as Pool B.

**Cookie shape:** Identical to Pool B. Host-scoped to `ops.windedvertigo.com`.

**Cross-pool isolation:** ops and port use the SAME cookie code, but
because cookies are host-scoped (no `domain`), `ops.windedvertigo.com`
sessions don't reach `port.windedvertigo.com` and vice versa. They're
two independent pools sharing one config.

## Cross-pool behavior

| Sign in at | Then visit | Authenticated? |
| --- | --- | --- |
| port | ops | NO — different host, no domain cookie |
| port | windedvertigo.com/harbour/depth-chart | NO — different cookie name and domain |
| ops | windedvertigo.com/harbour/depth-chart | NO — same reason |
| windedvertigo.com/harbour/creaseworks | windedvertigo.com/harbour/depth-chart | YES — both Pool A |
| windedvertigo.com/harbour/depth-chart | windedvertigo.com/harbour/vertigo-vault | YES — both Pool A |

## AUTH_SECRET parity

Even though the pools don't cross-share cookies, all three pools use
`AUTH_SECRET` to sign JWTs. If two pools held different secrets, a JWT
issued by one couldn't be verified by another — irrelevant given pools
don't read each other's cookies. **But:** the harbour pool's apps
(creaseworks, vault, depth-chart) MUST share `AUTH_SECRET` because they
DO read each other's cookies. A divergence here breaks SSO inside Pool A.

Verification (manual, requires secret access):
- Pool A: hash `AUTH_SECRET` from each Vercel project (`vercel env pull`)
  + each Worker (`wrangler secret list` doesn't show value, only name —
  so trust the cookie probe at runtime instead).
- Pool B/C: less critical to keep parity with each other; treat as
  "verify each pool internally."

## Implications for the launch-readiness plan

1. **Revise the SSO probe.** The existing probe in
   `windedvertigo/scripts/sso-cookie-probe.sh` checked all five hosts with
   one cookie value, which was always going to be misleading. Restructure:
   - `--harbour <cookie>` flag tests Pool A across the harbour hosts.
   - `--port <cookie>` flag tests Pool B (port only — single host).
   - `--ops <cookie>` flag tests Pool C (ops only — single host).
   - Default behavior: print usage and exit 2.
2. **User gate 1.A becomes three separate sign-ins** — one per pool. Still
   ~5 min total. The harbour-pool sign-in can be done at depth-chart,
   creaseworks, or vault (all set the same domain cookie).
3. **Phase 3 of the launch plan adds harbour as a fourth Pool A member.**
   No change to Pool B/C. The Phase 3 deploy is therefore a Pool A
   regression test.
4. **No change needed to AUTH_SECRET handling.** The migration record
   (`Phase 5 SSO confirmed: vault + depth-chart share .windedvertigo.com
   cookie, AUTH_SECRET parity`) was always about Pool A, just the
   wording is precise now.

## Action items captured in the launch plan

- Revise probe to be pool-aware. (Phase 1.2 follow-up — happening now.)
- Update launch plan Phase 1 user-gate text to reflect the three-pool
  architecture. (Plan-file edit — happening now.)
- Add a note to `windedvertigo/CLAUDE.md` describing the pools so future
  sessions don't re-derive the architecture. (Optional — defer until
  next doc sweep.)

## Confidence

High. Direct read of:
- `harbour-apps/packages/auth/{cookies,config}.ts`
- `windedvertigo/packages/auth/index.ts` (re-used by port via
  `@/lib/shared/auth` alias and by ops via `@windedvertigo/auth`)
- `apps/{creaseworks,vertigo-vault,depth-chart}/lib/auth.ts` per-app
  wrappers — all pass through to `createHarbourAuth` without overriding
  the cookies block.

# vinay — personal-assistant agent · development status

_living doc · workstream started 2026-07-23 · companion to `pa-agent-proposal.md` (the charter draft) and `agent-evolution-research-2026-07.md` (the research grounding). Structure + progress only — no personal specifics live here; this is the company repo._

vinay is the stage-3→5 pilot for the executive-agent platform: a single-principal (garrett-only) assistant that proves the graduated-autonomy mechanics on an audience of one before any exec agent is nudged along the ladder. It is deliberately **isolated** from the six exec agents at three layers — its own Supabase project, its own connector, and its own notification budget.

## design decisions (locked 2026-07-23)

| decision | choice |
|---|---|
| name / identity | `vinay` — `vinay_*` tools, `/api/mcp/vinay` connector, `wv-vinay` project |
| data placement | **own `wv-vinay` Supabase project** (leak-isolation at rest; +$10/mo) |
| auth | **garrett-only** — not the `@windedvertigo.com` domain allowlist the exec connector uses |
| budget + cards | **own budget + own table** (not the shared `agent_interventions`) |
| personal scope | **me-only** to start (no family surfaces; HIGH-tier locked) |
| Google account | personal account **in scope** — its OAuth connector is phase 1 |

## the boundary that matters (why the auth gate, not just the DB split)

The exec MCP gate admits any `@windedvertigo.com` account (`isAllowedEmail`) plus a shared static token. A separate database protects personal data *at rest* but not at the *query door*. So vinay's connector uses its own gate (`authorizeVinay`, `app/api/mcp/vinay/route.ts`):
- OAuth path requires `claims.sub === garrett@windedvertigo.com` exactly (`isVinayOwner`, `lib/oauth/config.ts`) — never the domain allowlist.
- Static path accepts only a dedicated `VINAY_API_TOKEN`, never the shared `CMO_API_TOKEN`.
- The connector is **not** part of the `/api/mcp/agents/all` bundle.

## phase 0 — memory + connector (this slice)

**Status: LIVE + verified 2026-07-24.** PR #424 (docs) + #425 (build) merged; `wv-vinay` project created (ref `geejfowrxvfhaevrevla`, us-west-1); migration applied; secrets set; deployed. Smoke test passed: unauth GET/POST → 401 with the OAuth challenge, bogus token → 401, and an authed `vinay_context` returns a clean empty state (confirming the DB URL + service-role key). The connector is **not** reachable via `/api/mcp/agents/all`.

**Built:**
- `wv-vinay` schema: `vinay_memory`, `vinay_decisions`, `vinay_commitments`, `vinay_journal` (RLS-on / service-role-only) — `port/supabase/migrations/20260723_vinay_phase0.sql`.
- Data layer `port/lib/vinay/*` (lazy per-request client over wv-vinay; `booking/client.ts` pattern).
- Garrett-only connector `port/app/api/mcp/vinay/route.ts` with 6 tools: `vinay_context`, `vinay_set_memory`, `vinay_add_commitment`, `vinay_update_commitment`, `vinay_log_journal`, `vinay_log_decision`.
- Session-end journaling: `/end-of-day-sync` skill logs a 3-line `did/open/next` to vinay when its connector is present.

**Go-live steps (all complete 2026-07-24):**
1. ✅ Created the `wv-vinay` Supabase project (+$10/mo).
2. ✅ Applied the migration in the wv-vinay project.
3. ✅ Set secrets: `VINAY_SUPABASE_URL`, `VINAY_SUPABASE_SERVICE_ROLE_KEY`, `VINAY_API_TOKEN` (+ optional `VINAY_OWNER_EMAIL`).
4. ✅ Deployed (`cd port && npm run deploy:cf`).
5. Connect the vinay MCP connector in Cowork at `https://port.windedvertigo.com/api/mcp/vinay` with the `VINAY_API_TOKEN` — ready whenever garrett wants day-to-day use.

## deferred (later phases — the phasing is a hypothesis, not a commitment)

- **Phase 1 — perception (read-only):** calendar + Gmail + Slack sweeps into an event log; daily anticipation brief. Work-account Gmail/Calendar already reachable server-side; **personal Google account = a new OAuth connector with real security surface** (a personal token leaked once before — store it as a secret, never baked into the build). Slack channel-history reading is one admin scope grant away.
- **Phase 2 — interventions:** `vinay_interventions` table (own budget helper parameterised from `intervention-budget.ts`), preview cards/DMs. **A fail-loud heartbeat is required here** — a silent no-op is the worst failure mode for a "did you forget X" agent (the spine fails open).
- **Phase 3 — delegation:** graduated action types act without preview, via the static Opsy classifier (`getActionTypeMetrics` parameterised to read vinay's table). Build the **demotion path first** — it is net-new code, not spine reuse.

## carried critique (constraints for every later phase)

- Workers runtime: per-request clients (#415), awaited/`waitUntil` side-effects (#414), no `process.env` trust in `after()`/background (#416). New crons are `/api/cron/vinay-*` routes on the internal dispatch table (no new triggers).
- Keep "graduation" (static thresholds) and "learning your preferences" (the ERL reflection loop) distinct — vinay does not have learned graduation.

# Voice pilot — handoff (resume here)

_Last updated: 2026-07-13. Branch: `main` (all merged)._

## TTS provider: Vapi-native, not Cartesia (as of 2026-07-13)

All 7 assistants now use `voice: {provider: "vapi", ...}` (see
`scripts/vapi-setup.mjs`) instead of Cartesia. Cause: a BYOK Cartesia
subscription is a fixed monthly credit ceiling that silently kills every call
once exhausted — that's what actually broke voice on 2026-07-12, alongside a
separate `silenceTimeoutSeconds` issue (see below). Vapi's own voices are
metered pay-as-you-go with no ceiling to exceed, and ~20x cheaper even at
phone-pilot volume. Each assistant also carries a `fallbackPlan` (another Vapi
voice, then OpenAI TTS) so a future TTS-layer failure degrades instead of
killing the call. The Cartesia-specific failure mode in the section below is
now historical — kept for context, not because it can still happen.

## Known failure modes — read this first when a call dies

The greeting always plays (it's static TTS, no LLM). If the call then dies or
gets ejected the instant you speak, the first real LLM turn (a POST to
`/api/voice/{slug}/chat/completions`) got a non-200. There are exactly two
causes on record — tell them apart with a direct curl:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://port.windedvertigo.com/api/voice/cmo/chat/completions \
  -H "Content-Type: application/json" -H "x-voice-secret: $VOICE_LLM_SECRET" \
  -H "User-Agent: OpenAI/JS 4.20.0" \
  -d '{"model":"gpt-4","stream":false,"messages":[{"role":"user","content":"hi"}]}'
```

- **403** → WAF block. The `/api/voice/` skip rule (see root `CLAUDE.md` §
  "Cloudflare WAF carve-out") got removed or narrowed. Fix: restore
  `starts_with(http.request.uri.path, "/api/voice/")` in the "allow anthropic
  mcp + oauth on api paths" skip rule. Full post-mortem:
  `docs/decisions/2026-06-22-voice-agents-waf-block-and-stacked-bugs.md`.
- **401** → secret drift. The `x-voice-secret` Vapi's assistants send no longer
  matches the worker's `VOICE_LLM_SECRET` (e.g. the worker secret was rotated
  without re-running `vapi-setup.mjs`, or vice versa). Fix — rotate + re-sync
  both sides together so they can't drift apart mid-fix:
  ```bash
  cd port
  NEW=$(openssl rand -hex 32)
  printf '%s' "$NEW" | npx wrangler secret put VOICE_LLM_SECRET
  export VAPI_API_KEY=<current key from Vapi dashboard>
  VOICE_LLM_SECRET="$NEW" VOICE_PUBLIC_BASE=https://port.windedvertigo.com \
    node scripts/vapi-setup.mjs
  BASE=https://port.windedvertigo.com VOICE_LLM_SECRET="$NEW" node scripts/voice-smoke-test.mjs
  ```
- **200 but empty/garbled reply** → worker reached Anthropic fine but
  something in the assistant/tool logic broke; check `wrangler tail` for the
  `[voice/{slug}]` error logs the route emits before it speaks a fallback
  apology line.

**Automated coverage (added 2026-07-12):** a tier-1 Opsy health check
(`voice` in `lib/opsy/services.ts` → `checkVoiceEndpoint` in
`lib/opsy/checks.ts`) runs this exact curl every 5 minutes via the existing
`*/5` cron and opens a `critical` incident on the worker's own health-check
table if it 403s/401s/times out — so drift surfaces in Opsy before the next
live call hits it. Needs the code change deployed (`npm run build:cf &&
npx wrangler deploy`) to take effect.

**This laptop's `.env.local` VAPI_API_KEY / VOICE_LLM_SECRET may be stale** —
both were found returning 401 (to Vapi's own API and to the worker,
respectively) on 2026-07-12. Refresh from the Mac Mini or password manager
before running any of the above from here.

Self-contained Vapi phone/voice channel for the 6 agents, built in `port/`
(Next.js → Cloudflare Worker `wv-port` → Supabase). No pocket-prompts dependency.
Spec: `~/Projects/voice-agents-claude-code-prompt.md`. Solo pilot (Garrett only).

## Status

- **Stage 1 (endpoints) + Stage 2 (6 Vapi assistants): DONE and merged** (PRs #242, #243).
- **`/voice` browser playground: live** at https://port.windedvertigo.com/voice (session-gated; PR #243). CSP fix for Vapi/Daily merged (PR #244).
- **Live voice call confirmed working** — successful conversation with Pam (2026-06-18). PR #245 merged.
- **WAF/hostname fix**: Vapi assistants' `model.url` points to the **workers.dev** hostname
  (`https://wv-port.windedvertigo.workers.dev/api/voice/{slug}`) to bypass CF zone WAF.
  Custom-domain URL still works on non-WAF paths but isn't used for voice.
- **Stage 2.5 — dashboard context (THIS SESSION, 2026-06-18):** Enriched briefings + voice tools. See below.

## Stage 2.5 — dashboard context (this session)

**Problem (Pam walkthrough feedback):** Pam felt limited — she only anchored to
agent-memory (decisions/commitments from Supabase), not the live dashboard (projects,
deals, campaigns, milestones).

**What was built (not yet deployed):**

### 1. Enriched briefings (`lib/voice/briefing.ts`)
All new Supabase queries run in parallel with existing ones (inside `Promise.all`),
so they add virtually no latency. Each has a `.catch(() => "_unavailable_")` guard.

- **PaM briefing**: now includes active projects, upcoming milestones (30 days),
  open BD deals — fetched in parallel with existing memory/commitments.
- **Mo briefing**: now includes open BD deals and active campaigns.
- Fin/Opsy/Carl/Claude: unchanged (Fin already has financial data; Opsy has ops data).

### 2. Server-side voice tools (`lib/voice/tools.ts` — new file)
Read-only Anthropic tools that run entirely on our server (Vapi never sees them):

| Tool | Slugs | What it does |
|------|-------|-------------|
| `lookup_projects` | pam, carl | Search active projects by name keyword |
| `lookup_deals` | pam, cmo, fin | Search open BD deals by name keyword |

**Latency design:** Tools are detected via the first `content_block_start` event type
in the streaming loop. Text turns start flowing immediately (zero added latency).
Tool turns add ~1-1.5s of dead air (Anthropic tool-detect → Supabase query →
second Anthropic streaming call) — acceptable for a specific data lookup. Max 1 tool
call per turn is enforced.

### 3. Route changes (`app/api/voice/[slug]/chat/completions/route.ts`)
The streaming loop now handles `content_block_start type=tool_use` events, buffers the
tool input JSON, executes the tool, then starts a second streaming Anthropic call.

**To deploy:** `cd port && npm run build:cf && npx wrangler deploy`
(Smoke-test secrets not on this laptop — run from Mac Mini or pull wrangler secrets.)

## IMPORTANT: secrets needed on this machine

The voice pilot secrets are NOT in this laptop's `.env.local`:
- `VOICE_ANTHROPIC_API_KEY` — copy from Mac Mini `.env.local` or `wrangler secret list`
- `VOICE_LLM_SECRET` — same
- `VAPI_API_KEY` — same

Run `npx wrangler secret list` on a machine with Cloudflare auth to see them.
The build works without secrets; smoke test and deploy need them.

## Hostname decision (priority 2)

**Recommendation: keep workers.dev for now.** A WAF skip rule would work but adds
CF config complexity. To add it later: Security → WAF → Custom Rules → create rule
"skip bot/managed rules for `/api/voice/*`", then re-run `vapi-setup.mjs` with
`VOICE_PUBLIC_BASE=https://port.windedvertigo.com`.

## Stage 4 — end-of-call transcript webhook (BUILT, needs deploy + vapi-setup re-run)

**What was built (2026-06-19):**
- `app/api/voice/[slug]/end-of-call/route.ts` — new webhook route.
  1. Verifies `Authorization: Bearer <VOICE_LLM_SECRET>` (Vapi sends serverUrlSecret this way).
  2. Ignores non-`end-of-call-report` webhook types (Vapi sends several types).
  3. Calls Haiku to summarise the transcript → `{ summary, decisions[] }`.
  4. Writes to each agent's Supabase table with `session_type: "voice"` (Fin uses `createFinDecision`).
  5. Always returns 200 — even on error — so Vapi doesn't retry and create duplicate rows.
  6. Logs a warning if `recordingUrl` is non-null (shouldn't happen, but surfaced explicitly).
- `scripts/vapi-setup.mjs` updated — adds `serverUrl`, `serverUrlSecret`,
  and `artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false }` to every assistant.

**To activate:**
```bash
# 1. Deploy the new route to prod
cd port && npm run build:cf && npx wrangler deploy

# 2. Push the serverUrl to Vapi (idempotent)
export VAPI_API_KEY=... VOICE_LLM_SECRET=... VOICE_PUBLIC_BASE=https://wv-port.windedvertigo.workers.dev
node scripts/vapi-setup.mjs
```

**To verify:** make a short test call → check the agent's decisions tab on
port.windedvertigo.com (or query `pam_decisions` where `session_type='voice'`).

## Next: Stage 3 (CONFIRM WITH GARRETT BEFORE PROCEEDING — PAID)

- **Stage 3 (PAID):** Provision 1 US phone number per assistant via Vapi API.
  Cost: ~$2/mo per number × 6 = ~$12/mo. Run: `node scripts/vapi-setup.mjs --provision-numbers`.
  _Confirm with Garrett before running — this charges the Vapi account._

## Key facts / IDs

- **Endpoint:** `POST https://wv-port.windedvertigo.workers.dev/api/voice/{slug}/chat/completions` (and the custom-domain equivalent). Auth: `x-voice-secret` header OR `Authorization: Bearer` = `VOICE_LLM_SECRET`.
- **Slugs → voice (Vapi-native, provider=vapi, as of 2026-07-13):** pam=Savannah, cmo(Mo)=Emma New, carl=Neil New, fin(Finn)=Godfrey New, opsy=Kai New, biz=Sagar New, claude=Elliot. Each has a `fallbackPlan` (another Vapi voice, then OpenAI TTS) — see `scripts/vapi-setup.mjs`.
- **Vapi assistant IDs:** Pam `ba635645-717d-4415-8bd6-640aa7a62a5c`, Mo `50aee5b0-e4e5-4b4f-8b19-d3ad05adae97`, Carl `9e3d60f5-47bd-4ca1-ad18-a0cc407c51f5`, Finn `083e9950-420e-459f-ae58-90f9ccb96ed9`, Opsy `d7d2a1e8-da87-42ad-997c-f0aa354f3549`, Claude `eadd9571-8cf7-44bc-a4b9-a2d0c4aaed69`. Named "WV Voice — {name}".
- **Vapi public key (client, publishable):** `9248eb66-2766-42e5-8022-b749368dc750` (hardcoded in `app/voice/page.tsx`).
- **Models:** agents `claude-sonnet-4-6`, claude line `claude-haiku-4-5-20251001`.

## Secrets needed locally (NOT in git — `.env.local` is gitignored)

On the Mac Mini, recreate `port/.env.local` with these (values are in this
machine's `port/.env.local`, and all are also set as `wrangler secret`s on
`wv-port`):
- `VOICE_ANTHROPIC_API_KEY` — the `voice-pilot` Anthropic key (direct to api.anthropic.com)
- `VOICE_LLM_SECRET` — shared secret gating the voice endpoint
- `VAPI_API_KEY` — Vapi private key (for `vapi-setup.mjs` + call inspection)
- `VOICE_BRIEFING_BASE_URL=https://port.windedvertigo.com` (legacy; briefings are now in-process so this is unused)

## Common commands

```bash
cd port
npm run build:cf && npx wrangler deploy            # build + deploy worker (gated: this is a prod deploy)
# smoke test all 6 endpoints (memory + caching):
export VOICE_LLM_SECRET=$(grep '^VOICE_LLM_SECRET=' .env.local | cut -d= -f2-)
BASE=https://wv-port.windedvertigo.workers.dev node scripts/voice-smoke-test.mjs
# (re)configure the 6 Vapi assistants (idempotent; choose the hostname):
export VAPI_API_KEY=... VOICE_LLM_SECRET=... VOICE_PUBLIC_BASE=https://wv-port.windedvertigo.workers.dev
node scripts/vapi-setup.mjs
```

## Architecture pointers

- `app/api/voice/[slug]/chat/completions/route.ts` — OpenAI-compatible streaming endpoint (one route, all slugs). 1.2s briefing timeout guard. Streaming loop handles `content_block_start type=tool_use` for server-side tool execution (max 1 tool call/turn).
- `lib/voice/briefing.ts` — **in-process** briefing assembly. Enriched with active projects, open deals, upcoming milestones (PaM), and campaigns (Mo) via parallel Supabase queries.
- `lib/voice/tools.ts` — **NEW** read-only voice tools (`lookup_projects`, `lookup_deals`). Per-slug assignment + server-side executor.
- `lib/voice/prompt.ts` — system-prompt builder + TTL-cached `fetchVoiceBriefing` → `buildVoiceBriefing`.
- `lib/voice/assistants.ts` — registry + Fin/Opsy postures.
- `app/voice/page.tsx` — the `/voice` playground (mic meter + `recordingEnabled:false`).
- `scripts/vapi-setup.mjs`, `scripts/voice-smoke-test.mjs` — setup + test.

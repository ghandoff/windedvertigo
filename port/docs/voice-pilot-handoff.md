# Voice pilot — handoff (resume here)

_Last updated: 2026-06-18. Branch: `fix/voice-llm-reachability`._

Self-contained Vapi phone/voice channel for the 6 agents, built in `port/`
(Next.js → Cloudflare Worker `wv-port` → Supabase). No pocket-prompts dependency.
Spec: `~/Projects/voice-agents-claude-code-prompt.md`. Solo pilot (Garrett only).

## Status

- **Stage 1 (endpoints) + Stage 2 (6 Vapi assistants): DONE and merged to main** (PRs #242, #243).
- **`/voice` browser playground: live** at https://port.windedvertigo.com/voice (session-gated; PR #243). CSP fix for Vapi/Daily merged (PR #244).
- **Currently debugging the live web call.** Two issues surfaced and are being worked:
  1. **Mic capture (client-side, flaky).** The Vapi web SDK always uses the OS default input device (no in-app picker exists). On Garrett's Mac, when the iPhone Continuity mic is active, audio is captured; otherwise some calls get `did-not-receive-customer-audio`. Mitigation shipped: a **mic-level meter** on `/voice` ("Test microphone" button) so you can confirm the default mic is live before talking. The real fix is OS-side (System Settings → Sound → Input → MacBook Pro Microphone).
  2. **`custom-llm-llm-failed` on the custom domain.** When audio WAS captured, Vapi called our endpoint and failed with `error-providerfault-custom-llm-llm-failed`, even though `curl` to the endpoint always returns 200 and streams fast (TTFB ~0.1–0.5s). The worker tail never clearly showed Vapi's POST arriving → strong hypothesis: **Cloudflare zone bot/WAF protection is blocking Vapi's server-to-server POST** on `port.windedvertigo.com`. **Mitigation applied (UNVERIFIED):** repointed all 6 Vapi assistants' `model.url` to the **workers.dev** hostname `https://wv-port.windedvertigo.workers.dev/api/voice/{slug}` (not behind the zone WAF). Needs one clean call to confirm.

## IMPORTANT: prod is ahead of git

The worker deployed to prod (**version `42d3f0e8`**) was built from this branch's
working tree but was **not yet committed to main**. This branch holds that code.
Do **not** deploy from `main` until this is merged, or you'll revert prod.

## The ONE next step

Do a clean end-to-end call to confirm the workers.dev fix:
1. Open https://port.windedvertigo.com/voice (must be logged into the port). Hard-refresh.
2. Click **Test microphone** → confirm the bar turns green / moves when you speak. If flat, switch the input device in macOS Sound settings.
3. **Talk to Pam** → let her greet → ask a question → she should **answer out loud**.
4. Verify on the backend:
   - **KV hit-logger** (durable proof Vapi reached the worker):
     `cd port && npx wrangler kv key get --namespace-id 267a63db1d4f4789a25b2cae406b6948 "voice:lasthit"`
     (a fresh timestamp = Vapi's request reached the worker.)
   - **Vapi call result:** `curl -s "https://api.vapi.ai/call?limit=1" -H "Authorization: Bearer $VAPI_API_KEY" | python3 -m json.tool | grep endedReason`
     — success looks like `customer-ended-call`, not `custom-llm-llm-failed`.

### If the call works
- Remove the diagnostic cruft from `app/api/voice/[slug]/chat/completions/route.ts`:
  the `[VOICE-HIT]` `console.log` and the **KV hit-logger** block + the
  `getCloudflareContext` import. Rebuild + deploy.
- Decide hostname: keep **workers.dev** (simplest), OR move `model.url` back to
  the custom domain and add a **Cloudflare WAF skip rule** for `/api/voice/*`
  (Security → WAF → custom rule: skip Bot Fight / managed rules for that path).
  Re-run `vapi-setup.mjs` with the chosen `VOICE_PUBLIC_BASE`.
- Then resume the staged plan: **Stage 3 = provision phone numbers (PAID — confirm with Garrett first)**, **Stage 4 = end-of-call transcript→memory webhook** (`recordingEnabled:false` already shipped on `/voice` web calls; still need it on the assistants/telephony + the transcript-save webhook).

### If the call still fails with custom-llm-llm-failed even on workers.dev
- The KV `voice:lasthit` will tell you whether Vapi reached the worker at all.
  - No fresh KV entry → request still not arriving → it's transport/network, not our code. Re-examine Vapi's outbound (does it actually append `/chat/completions`? is it hitting a different host?).
  - Fresh KV entry present but call failed → it IS reaching us; inspect the streaming response handling / Vapi's SSE expectations.

## Key facts / IDs

- **Endpoint:** `POST https://wv-port.windedvertigo.workers.dev/api/voice/{slug}/chat/completions` (and the custom-domain equivalent). Auth: `x-voice-secret` header OR `Authorization: Bearer` = `VOICE_LLM_SECRET`.
- **Slugs → voice (Cartesia, provider=cartesia):** pam=Ariana, cmo(Mo)=Amélie, carl=Adrian, fin(Finn)=Brent, opsy=Andi, claude=Cameron. Mo↔Opsy were intentionally swapped.
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

- `app/api/voice/[slug]/chat/completions/route.ts` — OpenAI-compatible streaming endpoint (one route, all slugs). Has a 1.2s briefing timeout guard + diagnostic logging (to remove).
- `lib/voice/briefing.ts` — **in-process** briefing assembly (replaced the old worker-to-itself HTTP call; that HTTP hop was a latency suspect, now eliminated).
- `lib/voice/prompt.ts` — system-prompt builder + TTL-cached `fetchVoiceBriefing` → `buildVoiceBriefing`.
- `lib/voice/assistants.ts` — registry + Fin/Opsy postures.
- `app/voice/page.tsx` — the `/voice` playground (mic meter + `recordingEnabled:false`).
- `scripts/vapi-setup.mjs`, `scripts/voice-smoke-test.mjs` — setup + test.

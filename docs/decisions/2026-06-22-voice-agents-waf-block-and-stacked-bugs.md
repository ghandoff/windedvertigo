# voice agents broke — three stacked bugs, and the WAF carve-out that was the real killer (2026-06-22)

post-mortem for the `port.windedvertigo.com/voice` outage. tl;dr: the
custom-llm endpoint `/api/voice/` must stay in the cloudflare WAF bot-protection
**skip** rule, exactly like `/api/mcp/`. it wasn't, so vapi's requests were
blocked at the edge. that was the headline cause — but two other bugs masked it
for hours, each producing a different error on each attempt.

## the headline gotcha — keep /api/voice/ in the WAF carve-out

the `windedvertigo.com` zone runs cloudflare super bot fight mode + managed
rules, which **block AI-bot user-agents**. there is one custom rule —
**"allow anthropic mcp + oauth on api paths"** (action: skip; skips "all managed
rules" + "all super bot fight mode rules") — that exempts specific paths.

vapi calls our custom-llm endpoint using the **openai js sdk**, so its
user-agent is `OpenAI/JS <version>` from an AWS IP (ASN 16509). the WAF matches
"OpenAI" as a bot and **blocks the request with 403 before it reaches the
worker**. the carve-out originally covered only `/api/mcp/`, `/api/oauth/`, and
`/.well-known/oauth` — **not** `/api/voice/` — so every during-call LLM turn was
silently dropped at the edge.

the fix: the skip rule's expression now also includes
`starts_with(http.request.uri.path, "/api/voice/")`. **do not remove it.** if it
goes, voice calls connect, the agent greets (the greeting is static TTS, no LLM),
then die the instant you speak — because the first real LLM turn is the first
blocked request.

note the asymmetry that makes this confusing: vapi's **end-of-call webhook** uses
a different (non-openai) user-agent, so it sails through even when the carve-out
is missing. so memory still gets written after the call while the call itself
fails. don't let "end-of-call is working" convince you the path is fine.

## why it took hours — three stacked bugs, each a different error

every retry surfaced a *different* failure, so it looked like a moving target.
the order we peeled them, outermost first:

1. **`pipeline-error-cartesia-voice-failed` (tts: 0).** cartesia deprecated the
   `sonic-english` model. vapi auto-selects the cartesia model from the voice id,
   and the older voice ids (amélie, brent, andi, …) mapped onto `sonic-english`.
   fix: pin `voice: { provider: "cartesia", voiceId, model: "sonic-3.5" }` on
   every assistant (see `port/scripts/vapi-setup.mjs`). applied live via
   `PATCH /assistant/<id>` — no redeploy needed.

2. **`error-providerfault-custom-llm-llm-failed` via slow first byte.** the route
   `await`ed the briefing fetch (≤1.2s) *before* returning the streaming
   `Response`, so vapi got no headers for ~1.7s warm / 4–5s cold and killed the
   turn. fix: return the stream immediately, flush the role chunk first, then do
   briefing + anthropic *inside* `start()` as inter-chunk delay
   (`port/app/api/voice/[slug]/chat/completions/route.ts`). **TTFB matters far
   more than total latency for vapi custom-llm.**

3. **"failed to load call object bundle … 503" (looked like a daily.co outage).**
   it wasn't daily — curl always got 200. the port's own service worker
   (`port/public/sw.js`) intercepted the **cross-origin** daily webrtc bundle via
   its static-asset branch, and on any fetch hiccup returned its *own* synthetic
   `Response("offline", {status: 503})`. a one-time daily blip got frozen into a
   permanent cached 503. fix: the sw now bails out of the fetch handler for any
   request whose origin ≠ the sw origin. **a service worker must never intercept
   third-party SDK loads.**

## the diagnostic that actually settled it

`wrangler tail` shows only requests that *reach* the worker, so an edge block is
invisible there — that's what made the WAF block look like "vapi never sent the
request." the decisive move was querying cloudflare's firewall events directly
(wrangler's oauth token can read graphql analytics even though it can't read
rulesets):

```
POST https://api.cloudflare.com/client/v4/graphql
query { viewer { zones(filter: {zoneTag: "<zoneTag>"}) {
  firewallEventsAdaptive(filter: {datetime_geq: "...", datetime_leq: "..."},
    limit: 50, orderBy: [datetime_DESC]) {
    datetime action ruleId clientRequestPath clientRequestHTTPMethodName
    userAgent clientAsn } } } }
```

the events showed `action: block`, `clientRequestPath: /api/voice/cmo/chat/completions`,
`userAgent: OpenAI/JS …`, right next to `action: skip` for `/api/mcp/agents/all`.
that one query made the whole thing obvious. **when a request is "missing" from
the worker logs, check firewall events before assuming the client didn't send
it.**

zone id and account id for the api calls:
- zone `windedvertigo.com`: `3b70c2ddcf9976faccb01d37ccf2e1ee`
- account: `097c92553b268f8360b74f625f6d980a`
- the skip rule: `846cda23ddf34a6cbf29da47c0cd9d39`; the block rule:
  `7bd01eeccb6b420fa0be30264603a5cb`.

## related, same session

- added a read-only `recall_memory` voice tool so agents can search their full
  memory mid-call, not just the 14-day briefing (`port/lib/voice/tools.ts`).
  each agent reads only its own `{slug}_decisions` / `{slug}_memory` tables — no
  shared pool.

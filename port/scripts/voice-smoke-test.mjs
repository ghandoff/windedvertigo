#!/usr/bin/env node
/**
 * Voice endpoint smoke test (Stage 1, local — no Vapi, no spend).
 *
 * For each of the six assistants it hits
 *   POST /api/voice/{slug}/chat/completions
 * exactly as Vapi's custom-llm client would: an OpenAI-shaped request body.
 *
 * It runs two checks per assistant:
 *   1. NON-STREAMING (stream:false) — confirms the brain answers and reports
 *      cache_read / cache_creation token counts so we can see prompt caching
 *      kick in on the second call.
 *   2. STREAMING (stream:true) — confirms OpenAI `chat.completion.chunk` SSE
 *      streams token-by-token and ends with [DONE].
 *
 * Usage:
 *   node scripts/voice-smoke-test.mjs            # base http://localhost:3005
 *   BASE=https://... node scripts/voice-smoke-test.mjs
 *   node scripts/voice-smoke-test.mjs pam carl   # subset of slugs
 */

const BASE = process.env.BASE ?? "http://localhost:3005";
// When the endpoint enforces VOICE_LLM_SECRET (deployed worker), send it.
const AUTH = process.env.VOICE_LLM_SECRET
  ? { Authorization: `Bearer ${process.env.VOICE_LLM_SECRET}` }
  : {};
const ALL = ["pam", "cmo", "carl", "fin", "opsy", "claude"];
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

// A prompt that should make each agent reach into its own live memory.
const PROBE = {
  pam: "what's the most overdue thing on my plate right now?",
  cmo: "what should we be focused on in marketing this week?",
  carl: "what's the latest finding you filed?",
  fin: "roughly how much runway do we have?",
  opsy: "is everything green right now?",
  claude: "in one sentence, what's a good way to prioritize a busy day?",
};

function reqBody(slug, stream) {
  return JSON.stringify({
    model: "custom",
    stream,
    messages: [
      { role: "system", content: "(vapi system message we expect to be ignored)" },
      { role: "user", content: PROBE[slug] ?? "hello, can you hear me?" },
    ],
  });
}

async function nonStream(slug) {
  const res = await fetch(`${BASE}/api/voice/${slug}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: reqBody(slug, false),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const u = data?.usage ?? {};
  return { text, usage: u };
}

async function streamCheck(slug) {
  const res = await fetch(`${BASE}/api/voice/${slug}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: reqBody(slug, true),
  });
  if (!res.ok || !res.body) {
    const t = res.body ? await res.text() : "(no body)";
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let chunks = 0;
  let text = "";
  let sawDone = false;
  let sawRole = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (payload === "[DONE]") { sawDone = true; continue; }
      try {
        const obj = JSON.parse(payload);
        const delta = obj?.choices?.[0]?.delta ?? {};
        if (delta.role) sawRole = true;
        if (typeof delta.content === "string") { text += delta.content; chunks++; }
      } catch { /* ignore keepalives */ }
    }
  }
  return { chunks, text, sawDone, sawRole };
}

function pass(b) { return b ? "✅" : "❌"; }

const results = [];
for (const slug of slugs) {
  process.stdout.write(`\n── ${slug} ──────────────────────────────\n`);
  try {
    // Two non-streaming calls: second should show cache_read > 0.
    const a = await nonStream(slug);
    const b = await nonStream(slug);
    const s = await streamCheck(slug);

    const cacheRead = b.usage.cache_read_input_tokens ?? 0;
    const cacheCreate = a.usage.cache_creation_input_tokens ?? 0;

    console.log(`non-stream reply : ${a.text.replace(/\s+/g, " ").slice(0, 160)}`);
    console.log(`stream  reply    : ${s.text.replace(/\s+/g, " ").slice(0, 160)}`);
    console.log(
      `cache            : create=${cacheCreate} read=${cacheRead} ${pass(cacheRead > 0)} (caching active on 2nd call)`,
    );
    console.log(
      `stream SSE       : ${s.chunks} content chunks, role=${pass(s.sawRole)} done=${pass(s.sawDone)}`,
    );

    const ok =
      a.text.length > 0 &&
      s.text.length > 0 &&
      s.chunks > 0 &&
      s.sawDone &&
      s.sawRole;
    results.push({ slug, ok, cacheRead });
    console.log(`overall          : ${pass(ok)}`);
  } catch (err) {
    console.log(`ERROR            : ❌ ${err.message}`);
    results.push({ slug, ok: false, cacheRead: 0 });
  }
}

console.log("\n════════ summary ════════");
for (const r of results) {
  console.log(`${pass(r.ok)} ${r.slug}${r.cacheRead > 0 ? "  (cache hit)" : ""}`);
}
const allOk = results.every((r) => r.ok);
console.log(allOk ? "\nALL PASS ✅" : "\nSOME FAILED ❌");
process.exit(allOk ? 0 : 1);

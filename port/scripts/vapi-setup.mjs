#!/usr/bin/env node
/**
 * Stage 2 — create/update the 6 Vapi voice assistants (config only, NO phone
 * numbers, no spend). Idempotent: matches existing assistants by name and
 * PATCHes them, otherwise POSTs a new one.
 *
 * Each assistant is a Vapi `custom-llm` pointing at its production voice
 * endpoint on the port. Auth to our endpoint is the VOICE_LLM_SECRET, sent as
 * an `x-voice-secret` header (Vapi forbids overriding Authorization via custom
 * headers, and our route accepts either).
 *
 * Env required: VAPI_API_KEY, VOICE_LLM_SECRET.
 * Usage: node scripts/vapi-setup.mjs
 */

const VAPI_KEY = process.env.VAPI_API_KEY;
const SECRET = process.env.VOICE_LLM_SECRET;
const BASE = process.env.VOICE_PUBLIC_BASE ?? "https://port.windedvertigo.com";
if (!VAPI_KEY || !SECRET) {
  console.error("Missing VAPI_API_KEY or VOICE_LLM_SECRET in env.");
  process.exit(1);
}

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

// slug, display name, Vapi-native voiceId, model, greeting
const ASSISTANTS = [
  { slug: "pam",   name: "Pam",  voice: "Leah", model: SONNET, greet: "hey, it's Pam. what are we moving today?" },
  { slug: "cmo",   name: "Mo",   voice: "Jess", model: SONNET, greet: "hi, Mo here. what's on your mind?" },
  { slug: "carl",  name: "Carl", voice: "Leo",  model: SONNET, greet: "hi, it's Carl. what are we looking into?" },
  { slug: "fin",   name: "Finn", voice: "Sid",  model: SONNET, greet: "hey, Finn here. want the numbers?" },
  { slug: "opsy",  name: "Opsy", voice: "Tara", model: SONNET, greet: "hi, it's Opsy. want a status check?" },
  { slug: "claude",name: "Claude",voice: "Kai", model: HAIKU,  greet: "hi Garrett, it's Claude. what can I help you think through?" },
];

const PREFIX = "WV Voice — "; // assistant display-name prefix in Vapi

function bodyFor(a) {
  return {
    name: `${PREFIX}${a.name}`,
    firstMessage: a.greet,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "custom-llm",
      url: `${BASE}/api/voice/${a.slug}`, // Vapi appends /chat/completions
      model: a.model,
      headers: { "x-voice-secret": SECRET },
    },
    voice: { provider: "vapi", voiceId: a.voice },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    // 1:1 call turn-taking: respond promptly, allow barge-in interruptions.
    startSpeakingPlan: { waitSeconds: 0.4 },
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 1800,
  };
}

async function vapi(path, method, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${VAPI_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

const existing = await vapi("/assistant", "GET");
const byName = new Map((Array.isArray(existing) ? existing : []).map((a) => [a.name, a.id]));

const results = [];
for (const a of ASSISTANTS) {
  const body = bodyFor(a);
  try {
    const id = byName.get(body.name);
    const saved = id
      ? await vapi(`/assistant/${id}`, "PATCH", body)
      : await vapi("/assistant", "POST", body);
    results.push({ name: a.name, slug: a.slug, voice: a.voice, id: saved.id, action: id ? "updated" : "created" });
    console.log(`✅ ${a.name.padEnd(7)} ${id ? "updated" : "created"}  id=${saved.id}  voice=${a.voice}  → ${body.model.url}`);
  } catch (err) {
    console.log(`❌ ${a.name.padEnd(7)} ${err.message}`);
    results.push({ name: a.name, slug: a.slug, error: String(err.message) });
  }
}

console.log("\n=== assistant IDs ===");
for (const r of results) console.log(`${r.name}\t${r.id ?? r.error}`);
const ok = results.every((r) => r.id);
console.log(ok ? "\nALL 6 CONFIGURED ✅ (no phone numbers — Stage 3)" : "\nSOME FAILED ❌");
process.exit(ok ? 0 : 1);

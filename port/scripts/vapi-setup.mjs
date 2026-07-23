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

// slug, display name, Vapi-native voiceId, model, greeting.
// Switched off Cartesia 2026-07-13: a BYOK Cartesia subscription is a fixed
// monthly credit ceiling (100K-1.25M chars) that silently blocks ALL calls
// once exhausted — which is what actually broke voice that day, not a code
// bug. Vapi's own native voices (provider "vapi") are metered pay-as-you-go
// at $0.0025/min with no ceiling to exceed, ~20x cheaper than Cartesia even
// at real phone-pilot volume.
// version:2 is opt-in per assistant and cheaper/higher-quality than v1;
// Rohan has no v2 so it's excluded from the picks below.
// No voice.fallbackPlan here: Vapi's own voices carry managed auto-fallback
// server-side and reject an explicit fallbackPlan (confirmed via 400 on the
// live API — "managed auto-fallback is always on").
const ASSISTANTS = [
  { slug: "pam",   name: "Pam",  voice: "Savannah", model: SONNET, greet: "hey, it's Pam. what are we moving today?",
    idle: ["hey, you still with me? no rush — take the time you need."] },
  { slug: "cmo",   name: "Mo",   voice: "Emma",     model: SONNET, greet: "hi, Mo here. what's on your mind?",
    idle: ["still there? happy to wait, no pressure."] },
  { slug: "carl",  name: "Carl", voice: "Neil",     model: SONNET, greet: "hi, it's Carl. what are we looking into?",
    idle: ["take your time — i'm here when you're ready to continue."] },
  { slug: "fin",   name: "Finn", voice: "Godfrey",  model: SONNET, greet: "hey, Finn here. want the numbers?",
    idle: ["still with me? happy to wait while you check something."] },
  { slug: "opsy",  name: "Opsy", voice: "Kai",      model: SONNET, greet: "hi, it's Opsy. want a status check?",
    idle: ["just checking you're still there — no rush."] },
  { slug: "biz",   name: "Biz",  voice: "Sagar",    model: SONNET, greet: "hey, it's Biz. what are we pursuing?",
    idle: ["still there? take a beat, i'll wait."] },
  { slug: "claude",name: "Claude",voice: "Elliot",  model: HAIKU, greet: "hi Garrett, it's Claude. what can I help you think through?",
    idle: ["still there? take your time, no pressure."] },
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
    voice: { provider: "vapi", voiceId: a.voice, version: 2 },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    // 1:1 call turn-taking: respond promptly, allow barge-in interruptions.
    startSpeakingPlan: { waitSeconds: 0.4 },
    // 30s -> 60s 2026-07-12, then -> 120s 2026-07-14: even 60s cut off a
    // genuine 24-min conversation mid-thought (Vapi's own silence-timeout,
    // not a code bug). 120s gives real thinking pauses more room.
    silenceTimeoutSeconds: 120,
    maxDurationSeconds: 1800,
    // Idle check-in: speaks a per-agent nudge at 45s of silence (well above
    // Vapi's reported ~40s floor for the hook to actually fire) instead of
    // just letting the call go quiet until the 120s hard cutoff. Resets on
    // any speech from Garrett; fires at most twice per call.
    hooks: [
      {
        on: "customer.speech.timeout",
        options: { timeoutSeconds: 45, triggerMaxCount: 2, triggerResetMode: "onUserSpeech" },
        do: [{ type: "say", exact: a.idle }],
      },
    ],
    // Stage 4: end-of-call webhook saves transcript summary to agent memory.
    serverUrl: `${BASE}/api/voice/${a.slug}/end-of-call`,
    serverUrlSecret: SECRET,
    // Explicit: no audio or video recordings retained anywhere.
    artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false },
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
console.log(ok ? "\nALL 7 CONFIGURED ✅ (no phone numbers — Stage 3)" : "\nSOME FAILED ❌");
process.exit(ok ? 0 : 1);

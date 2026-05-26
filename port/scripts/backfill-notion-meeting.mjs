#!/usr/bin/env node
/**
 * One-shot backfill: takes Notion AI meeting notes text, runs them through
 * Claude to extract structured action items + summary, then merges into the
 * existing Supabase meeting row at the given id.
 *
 * Standalone — re-implements just enough of lib/ai/meeting-actions and
 * lib/meeting-ingest/ingest-to-supabase to backfill the PRME meeting without
 * needing a worker deploy or the wider Next.js runtime.
 *
 * Usage:
 *   node /tmp/backfill_prme.mjs <meeting-id> <path-to-notes.md> <owner-email>
 */

import fs from "node:fs";
import process from "node:process";
import Anthropic from "@anthropic-ai/sdk";

const [, , MEETING_ID, NOTES_PATH, OWNER_EMAIL] = process.argv;
if (!MEETING_ID || !NOTES_PATH || !OWNER_EMAIL) {
  console.error("usage: backfill_prme.mjs <meeting-id> <notes.md> <owner-email>");
  process.exit(1);
}

const {
  ANTHROPIC_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: SB_URL,
  SUPABASE_SECRET_KEY: SB_KEY,
} = process.env;

if (!ANTHROPIC_API_KEY || !SB_URL || !SB_KEY) {
  console.error("missing env: ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const notes = fs.readFileSync(NOTES_PATH, "utf8");

// --- 1. Extract action items + summary via Claude Haiku --------------------
const SYSTEM_PROMPT = `You are extracting action items from meeting notes for winded.vertigo, a learning design collective.

Given meeting notes or a transcript, extract concrete action items. For each action:
- title: concise task description (lowercase)
- owner: person's first name (extract from context, or "unassigned" if unclear)
- deadline: ISO date string if mentioned (e.g. "2026-04-15"), null if not specified
- type: one of: plan, implement, coordinate, review, admin
- priority: low, medium, or high (infer from urgency cues)
- context: 1 sentence of relevant context

Also provide a 2-3 sentence summary.

Output ONLY valid JSON:
{ "actions": [...], "meetingSummary": "..." }`;

const today = new Date().toISOString().split("T")[0];
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

console.error("→ calling Claude to extract actions...");
const resp = await anthropic.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 4096,
  temperature: 0.2,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: `Today: ${today}\n\nMeeting notes:\n${notes}` }],
});

const rawText = resp.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("");

// Repair pass: strip ```json fences if any
const cleaned = rawText
  .replace(/^```(?:json)?\s*/, "")
  .replace(/```\s*$/, "")
  .trim();

let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  console.error("JSON parse failed. raw response head:");
  console.error(cleaned.slice(0, 500));
  process.exit(1);
}

console.error(`→ extracted ${parsed.actions.length} actions`);
console.error(`→ summary: ${parsed.meetingSummary.slice(0, 100)}...`);

// --- 2. Fetch active members for owner resolution --------------------------
async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`SB GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbPatch(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB PATCH ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbPost(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB POST ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

const members = await sbGet("members?select=name,email&active=eq.true");
const ownerMap = new Map();
for (const m of members) {
  if (m.name && m.email) {
    const first = m.name.split(/\s+/)[0].toLowerCase();
    ownerMap.set(first, { name: m.name, email: m.email.toLowerCase() });
  }
}
console.error(`→ loaded ${ownerMap.size} active members for owner resolution`);

function resolveOwner(raw) {
  const key = (raw || "").trim().toLowerCase();
  const m = ownerMap.get(key);
  return m ? { ownerEmail: m.email, ownerName: m.name } : { ownerEmail: null, ownerName: raw };
}

// --- 3. Update meeting row with summary + owner -----------------------------
console.error("→ patching meeting row...");
const updated = await sbPatch(`meetings?id=eq.${MEETING_ID}`, {
  summary: parsed.meetingSummary,
  owner_email: OWNER_EMAIL,
  captured_via: "notion-legacy",
  updated_at: new Date().toISOString(),
});
console.error(`  patched: ${updated[0]?.id}`);

// --- 4. Insert action items -------------------------------------------------
const actionRows = parsed.actions.map((a) => {
  const { ownerEmail, ownerName } = resolveOwner(a.owner);
  return {
    meeting_id: MEETING_ID,
    title: a.title,
    owner_email: ownerEmail,
    owner_name: ownerName,
    deadline: a.deadline,
    priority: a.priority,
    type: a.type,
    context: a.context,
    status: "open",
  };
});

console.error(`→ inserting ${actionRows.length} action items...`);
const inserted = await sbPost("meeting_action_items", actionRows);
console.error(`  inserted: ${inserted.length}`);

console.error("\nDone. View at:");
console.error(`  https://port.windedvertigo.com/council/${MEETING_ID}`);

console.error("\nUsage:", JSON.stringify({
  inputTokens: resp.usage.input_tokens,
  outputTokens: resp.usage.output_tokens,
}));

/**
 * POST /api/voice/{slug}/end-of-call
 *
 * Vapi end-of-call webhook. Receives the call transcript, summarises it with
 * Haiku, and writes a voice-session decision to the agent's Supabase memory.
 *
 * Vapi sends this as a JSON body with message.type === "end-of-call-report".
 * Other webhook types (status-update, speech-update, etc.) are ACK'd and
 * ignored. Vapi sends serverUrlSecret as "Authorization: Bearer <secret>",
 * which our existing dual-header verifier already handles.
 *
 * We always return 200 — even on summarise/save errors — so Vapi does not
 * retry and cause duplicate memory entries.
 */

import { NextRequest } from "next/server";
import { error } from "@/lib/api-helpers";
import { getAssistant } from "@/lib/voice/assistants";
import { getVoiceAnthropic } from "@/lib/voice/anthropic";
import { insertPamDecision } from "@/lib/supabase/pam";
import { insertCmoDecision } from "@/lib/supabase/cmo";
import { insertCarlDecision } from "@/lib/supabase/carl";
import { insertOpsyDecision } from "@/lib/supabase/opsy";
import { createFinDecision } from "@/lib/fin-data";

const HAIKU = "claude-haiku-4-5-20251001";

function verifyVapiCaller(req: NextRequest): boolean {
  const secret = process.env.VOICE_LLM_SECRET;
  if (!secret) return true; // dev / local without secrets
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = req.headers.get("x-vapi-secret");
  return bearer === secret || header === secret;
}

interface SummaryResult {
  summary: string;
  decisions: string[];
}

async function summariseTranscript(
  agentName: string,
  transcript: string,
): Promise<SummaryResult> {
  const anthropic = getVoiceAnthropic();
  const resp = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 512,
    system: `Extract a concise summary from a voice-call transcript between Garrett and an AI agent named ${agentName}.
Return ONLY a valid JSON object — no preamble, no markdown fences — with exactly two keys:
- "summary": 2-3 sentences covering what was discussed and any outcomes.
- "decisions": array of short action items or decisions (10 words max each), or [] if none.`,
    messages: [
      {
        role: "user",
        content: transcript.slice(0, 6000),
      },
    ],
  });

  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");

  try {
    const parsed = JSON.parse(text) as SummaryResult;
    return {
      summary: String(parsed.summary ?? text.slice(0, 500)),
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
    };
  } catch {
    return { summary: text.slice(0, 500), decisions: [] };
  }
}

async function saveToMemory(
  slug: string,
  summary: string,
  decisions: string[],
  transcript: string,
): Promise<void> {
  const shared = {
    who: "garrett",
    summary,
    decisions,
    tags: ["voice-call"],
    session_type: "voice",
    raw_context: transcript.slice(0, 2000),
  };

  switch (slug) {
    case "pam":
      await insertPamDecision(shared);
      break;
    case "cmo":
      await insertCmoDecision(shared);
      break;
    case "carl":
      await insertCarlDecision(shared);
      break;
    case "opsy":
      await insertOpsyDecision(shared);
      break;
    case "fin":
      await createFinDecision({
        decision: summary,
        context: decisions.length ? decisions.join("; ") : undefined,
        logged_by: "garrett",
        category: "voice-call",
      });
      break;
    // "claude" has no Supabase memory — handled before this function is called
  }
}

interface VapiWebhookBody {
  message?: {
    type?: string;
    endedReason?: string;
    transcript?: string;
    call?: {
      id?: string;
      assistantId?: string;
      startedAt?: string;
      endedAt?: string;
    };
    summary?: string;
    recordingUrl?: string | null;
  };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!verifyVapiCaller(req)) return error("unauthorized", 401);

  const { slug } = await ctx.params;
  const assistant = getAssistant(slug);
  if (!assistant) return error(`unknown voice assistant: ${slug}`, 404);

  let body: VapiWebhookBody;
  try {
    body = (await req.json()) as VapiWebhookBody;
  } catch {
    return error("invalid JSON", 400);
  }

  const msg = body.message;

  // Vapi sends many webhook types — only end-of-call-report has a transcript.
  if (msg?.type !== "end-of-call-report") {
    return Response.json({ ok: true, skipped: msg?.type ?? "unknown" });
  }

  // Guard: no meaningful recording to save.
  if (msg.recordingUrl) {
    console.warn(`[voice/end-of-call/${slug}] unexpected recordingUrl — check Vapi recording settings`);
  }

  const transcript = (msg.transcript ?? "").trim();
  if (transcript.length < 50) {
    return Response.json({ ok: true, note: "transcript too short, skipping" });
  }

  // Claude line has no agent memory.
  if (slug === "claude") {
    return Response.json({ ok: true, note: "claude line has no memory" });
  }

  try {
    const { summary, decisions } = await summariseTranscript(assistant.name, transcript);
    await saveToMemory(slug, summary, decisions, transcript);
    console.log(`[voice/end-of-call/${slug}] saved: ${summary.slice(0, 80)}`);
    return Response.json({ ok: true, decisions: decisions.length });
  } catch (err) {
    // Return 200 anyway — retries would cause duplicate memory rows.
    const msg2 = err instanceof Error ? err.message : "unknown error";
    console.error(`[voice/end-of-call/${slug}] save failed:`, msg2);
    return Response.json({ ok: true, error: msg2 });
  }
}

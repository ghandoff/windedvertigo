/**
 * POST /api/voice/{slug}/chat/completions
 *
 * OpenAI-compatible, streaming chat-completions endpoint that Vapi calls as a
 * `custom-llm` model. One route serves all six voice assistants (pam, cmo,
 * carl, fin, opsy, claude) — the {slug} selects which brain/voice.
 *
 * Flow per turn:
 *   1. Resolve the assistant from the slug.
 *   2. Load its live briefing (TTL-cached, enriched with projects/deals/milestones)
 *      + build a cached system prompt from posture + spoken-delivery rules.
 *   3. Call Anthropic (dedicated voice key, prompt caching on the static prefix).
 *      If the agent calls a tool (read-only lookup), execute it server-side and
 *      make a second Anthropic call with the result. Max 1 tool call per turn.
 *   4. Stream the final reply back as OpenAI `chat.completion.chunk` SSE —
 *      the shape Vapi expects — then `data: [DONE]`.
 *
 * Tool-use latency: text turns start streaming immediately (zero added latency).
 * Tool turns buffer while the tool runs (~50-100ms Supabase + Anthropic second
 * call) — the agent hears ~1-1.5s dead air for a specific data lookup, which is
 * normal on a phone call. Max 1 tool call per turn enforces this bound.
 *
 * Non-streaming requests (stream:false) return a single OpenAI completion JSON,
 * which the local smoke test and curl can use.
 *
 * No runtime dependency on pocket-prompts. Self-contained in the port.
 */

import { NextRequest } from "next/server";
import { error } from "@/lib/api-helpers";
import { getAssistant, modelFor } from "@/lib/voice/assistants";
import {
  fetchVoiceBriefing,
  buildStaticSystemPrefix,
  buildBriefingSuffix,
} from "@/lib/voice/prompt";
import { getVoiceAnthropic } from "@/lib/voice/anthropic";
import { getVoiceTools, executeVoiceTool } from "@/lib/voice/tools";

const MAX_TOKENS = 1024; // spoken replies are short
const BRIEFING_DEADLINE_MS = 1200; // cap briefing assembly so first-token stays fast

/**
 * Verify the Vapi custom-llm caller. When VOICE_LLM_SECRET is set we accept the
 * secret via EITHER `Authorization: Bearer <secret>` OR an `x-voice-secret`
 * header. Vapi forbids overriding `Authorization` through its custom-headers
 * feature (that needs the credential system), so the assistants send the secret
 * as `x-voice-secret`. When the env is unset — local dev / smoke test — the
 * check is skipped.
 */
function verifyVoiceCaller(req: NextRequest): boolean {
  const secret = process.env.VOICE_LLM_SECRET;
  if (!secret) return true;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const header = req.headers.get("x-voice-secret");
  return bearer === secret || header === secret;
}

interface IncomingMessage {
  role: string;
  content: unknown;
}

/** Flatten OpenAI message content (string or content-part array) to text. */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        typeof p === "string"
          ? p
          : p && typeof p === "object" && "text" in p
            ? String((p as { text: unknown }).text ?? "")
            : "",
      )
      .join("");
  }
  return "";
}

/**
 * Map inbound OpenAI messages to Anthropic messages: drop system roles (we
 * inject our own), keep user/assistant turns, coerce content to text, and
 * ensure the conversation starts on a user turn.
 */
function toAnthropicMessages(
  messages: IncomingMessage[],
): { role: "user" | "assistant"; content: string }[] {
  const mapped = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: contentToText(m.content),
    }))
    .filter((m) => m.content.trim().length > 0);

  // Anthropic requires the first message to be from the user.
  while (mapped.length && mapped[0].role !== "user") mapped.shift();

  // Cold open (Vapi sometimes calls with no user turn yet): seed one.
  if (mapped.length === 0) {
    mapped.push({ role: "user", content: "(the caller just connected.)" });
  }
  return mapped;
}

function openAiChunk(
  id: string,
  created: number,
  model: string,
  delta: Record<string, unknown>,
  finishReason: string | null,
): string {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!verifyVoiceCaller(req)) return error("unauthorized", 401);

  const { slug } = await ctx.params;
  const assistant = getAssistant(slug);
  if (!assistant) return error(`unknown voice assistant: ${slug}`, 404);

  let body: { messages?: IncomingMessage[]; stream?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error("invalid JSON", 400);
  }

  const messages = toAnthropicMessages(body.messages ?? []);
  const model = modelFor(assistant);

  // System-prompt assembly: cached static prefix + live briefing suffix.
  // Bound the briefing assembly so the first token is never gated on a slow
  // cold turn (Vapi fails the custom-llm turn if first-token is too slow). On
  // timeout we proceed without live memory; the in-flight build still warms the
  // cache, so the next turn in the call has full context. Fail-open.
  //
  // IMPORTANT: in the streaming path this runs INSIDE the stream (after the
  // first byte is flushed), so Vapi gets response headers immediately and the
  // briefing/cold-start latency becomes inter-chunk delay rather than
  // time-to-first-byte. Awaiting it before returning the Response is what made
  // Vapi time out with error-providerfault-custom-llm-llm-failed.
  const buildSystem = async () => {
    const briefing = await Promise.race([
      fetchVoiceBriefing(assistant),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), BRIEFING_DEADLINE_MS)),
    ]);
    const staticPrefix = buildStaticSystemPrefix(assistant);
    const briefingSuffix = buildBriefingSuffix(briefing);

    const system: {
      type: "text";
      text: string;
      cache_control?: { type: "ephemeral" };
    }[] = [{ type: "text", text: staticPrefix }];
    if (briefingSuffix) system.push({ type: "text", text: briefingSuffix });
    // Cache the whole system region (posture + briefing). The briefing is stable
    // within a call (TTL-cached), so turns 2..N of a call hit the cache. Marking
    // the LAST block caches everything before it too.
    system[system.length - 1].cache_control = { type: "ephemeral" };
    return system;
  };

  const anthropic = getVoiceAnthropic();
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const stream = body.stream !== false; // default to streaming (Vapi)
  const voiceTools = getVoiceTools(assistant.slug);

  // ── Non-streaming path (smoke test / curl) ──────────────────────────────
  if (!stream) {
    try {
      const system = await buildSystem();
      const resp = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(voiceTools.length ? { tools: voiceTools as any } : {}),
      });
      const text = resp.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      return Response.json({
        id,
        object: "chat.completion",
        created,
        model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: text },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: resp.usage.input_tokens,
          completion_tokens: resp.usage.output_tokens,
          total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
          // surfaced for the smoke test to confirm caching is active
          cache_creation_input_tokens:
            (resp.usage as { cache_creation_input_tokens?: number })
              .cache_creation_input_tokens ?? 0,
          cache_read_input_tokens:
            (resp.usage as { cache_read_input_tokens?: number })
              .cache_read_input_tokens ?? 0,
        },
      });
    } catch (err) {
      console.error(`[voice/${slug}] non-stream error:`, err);
      return error(err instanceof Error ? err.message : "anthropic error", 502);
    }
  }

  // ── Streaming path (OpenAI SSE for Vapi) ────────────────────────────────
  //
  // Tool-use detection via the first content_block_start event:
  // - type=text  → stream deltas directly (zero added latency, the common case).
  // - type=tool_use → buffer the tool input; execute server-side; make a second
  //   streaming Anthropic call with the result; then stream that reply.
  //
  // Max 1 tool call per turn (didCallTool guard) keeps dead air bounded.
  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        // First chunk announces the assistant role. Flushing this immediately
        // (before the briefing fetch / Anthropic call) gives Vapi response
        // headers + a first byte within milliseconds, so cold-start and briefing
        // latency never gate time-to-first-byte. This is what prevents the
        // error-providerfault-custom-llm-llm-failed timeout.
        send(openAiChunk(id, created, model, { role: "assistant" }, null));

        // Now do the slow work: assemble the system prompt (briefing race) and
        // open the Anthropic stream. These add inter-chunk delay, which Vapi
        // tolerates, rather than blocking the response headers.
        const system = await buildSystem();
        const anthropicStream = await anthropic.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          stream: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(voiceTools.length ? { tools: voiceTools as any } : {}),
        });

        let currentBlockType: "text" | "tool_use" | null = null;
        let toolName = "";
        let toolUseId = "";
        let toolInputJson = "";
        let didCallTool = false;

        for await (const event of anthropicStream) {
          if (event.type === "content_block_start") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const block = event.content_block as any;
            currentBlockType = block.type;
            if (currentBlockType === "tool_use") {
              toolName = String(block.name ?? "");
              toolUseId = String(block.id ?? "");
              toolInputJson = "";
            }
          } else if (event.type === "content_block_delta") {
            if (currentBlockType === "text" &&
                event.delta.type === "text_delta" &&
                event.delta.text) {
              send(openAiChunk(id, created, model, { content: event.delta.text }, null));
            } else if (currentBlockType === "tool_use") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = event.delta as any;
              if (d.type === "input_json_delta") toolInputJson += d.partial_json ?? "";
            }
          } else if (
            event.type === "message_delta" &&
            event.delta.stop_reason === "tool_use" &&
            !didCallTool
          ) {
            // Tool call complete — execute and stream a second Anthropic response.
            didCallTool = true;
            let toolInput: Record<string, unknown> = {};
            try { toolInput = JSON.parse(toolInputJson || "{}"); } catch { /* keep {} */ }

            const toolResult = await executeVoiceTool(toolName, toolInput).catch(
              () => "(tool lookup failed)",
            );

            // Build tool_result message and get the agent's final reply.
            const messagesWithTool = [
              ...messages,
              {
                role: "assistant" as const,
                content: [{
                  type: "tool_use" as const,
                  id: toolUseId,
                  name: toolName,
                  input: toolInput,
                }],
              },
              {
                role: "user" as const,
                content: [{
                  type: "tool_result" as const,
                  tool_use_id: toolUseId,
                  content: toolResult,
                }],
              },
            ];

            const secondStream = await anthropic.messages.create({
              model,
              max_tokens: MAX_TOKENS,
              system,
              messages: messagesWithTool,
              stream: true,
            });

            for await (const e2 of secondStream) {
              if (
                e2.type === "content_block_delta" &&
                e2.delta.type === "text_delta" &&
                e2.delta.text
              ) {
                send(openAiChunk(id, created, model, { content: e2.delta.text }, null));
              }
            }
          }
        }

        send(openAiChunk(id, created, model, {}, "stop"));
      } catch (err) {
        console.error(`[voice/${slug}] stream error:`, err);
        // Surface something speakable rather than a dead call.
        send(
          openAiChunk(
            id,
            created,
            model,
            { content: " sorry, I hit a problem just now. could you say that again?" },
            "stop",
          ),
        );
      } finally {
        send("data: [DONE]\n\n");
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

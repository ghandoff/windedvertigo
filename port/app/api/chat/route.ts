/**
 * POST /api/chat
 *
 * Web chat endpoint for Mo, PaM, and cARL. Accepts a message from an
 * authenticated port user and streams the agent's response back as SSE.
 *
 * Request body: { agent: "mo" | "pam" | "carl", message: string, threadId: string }
 * Response: text/event-stream — events are `data: {"text":"..."}` and `data: [DONE]`
 *
 * Same budget caps, audit logging, and memory semantics as the Slack path.
 * Tool calls (log_decision, update_memory, etc.) run synchronously before
 * the final text response is streamed.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { error } from "@/lib/api-helpers";
import type { AgentId } from "@/lib/agent/agent-router";
import {
  fetchAgentBriefing,
  buildAgentSystemPrompt,
} from "@/lib/agent/agent-prompts";
import { MO_TOOLS } from "@/lib/agent/tools/mo";
import { PAM_TOOLS } from "@/lib/agent/tools/pam";
import { CARL_TOOLS } from "@/lib/agent/tools/carl";
import { executeAgentApiTool } from "@/lib/agent/tools/port-api-executor";
import {
  getRecentMessages,
  appendMessage,
} from "@/lib/supabase/agent-thread-messages";
import { getRecentSpendByUser } from "@/lib/supabase/agent-actions";
import { auditTurn } from "@/lib/agent/audit";
import { MODEL_PRICING, type ModelId } from "@/lib/ai/types";

const MAX_AGENT_TURNS = 5;
const DAILY_BUDGET_USD = parseFloat(
  process.env.WV_CLAW_DAILY_BUDGET_USD ?? "5",
);
const MODEL_ID: ModelId = "claude-sonnet-4-6";

const anthropic = new Anthropic();

const AGENT_TOOLS = {
  mo:   [...MO_TOOLS],
  pam:  [...PAM_TOOLS],
  carl: [...CARL_TOOLS],
};

const VALID_AGENTS = new Set<string>(["mo", "pam", "carl"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return error("not authenticated", 401);
  }

  const userEmail = session.user.email;
  const firstName =
    (session as unknown as Record<string, unknown>).firstName as string ??
    session.user.name?.split(" ")[0]?.toLowerCase() ??
    userEmail.split("@")[0];
  const displayName =
    session.user.name?.split(" ")[0] ?? firstName ?? userEmail.split("@")[0];

  let body: { agent?: string; message?: string; threadId?: string };
  try {
    body = await req.json();
  } catch {
    return error("invalid JSON", 400);
  }

  const { agent, message, threadId } = body;

  if (!agent || !VALID_AGENTS.has(agent)) {
    return error("agent must be one of: mo, pam, carl", 400);
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return error("message is required", 400);
  }
  if (!threadId || typeof threadId !== "string") {
    return error("threadId is required", 400);
  }

  const agentId = agent as Exclude<AgentId, "port">;

  // Per-user daily budget guard.
  const recentSpend = await getRecentSpendByUser(userEmail, 24);
  if (recentSpend >= DAILY_BUDGET_USD) {
    return error(
      `daily spend cap reached ($${DAILY_BUDGET_USD.toFixed(2)} — currently at $${recentSpend.toFixed(2)}). resets at midnight UTC.`,
      429,
    );
  }

  // Load thread history and fetch briefing in parallel.
  const chatThreadKey = `web:${agentId}:${userEmail}:${threadId}`;
  const [history, briefing] = await Promise.all([
    getRecentMessages(chatThreadKey, { limit: 20, withinMinutes: 480 }),
    fetchAgentBriefing(agentId),
  ]);

  const systemPrompt = buildAgentSystemPrompt(
    agentId,
    briefing,
    displayName,
    userEmail,
    "web",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message.trim() },
  ];

  const tools = AGENT_TOOLS[agentId];

  const startMs = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreateTokens = 0;
  let totalCacheReadTokens = 0;
  let finalText = "";
  let agentError: string | null = null;
  const toolsCalledNames: string[] = [];
  const eventId = `web:${agentId}:${Date.now()}:${userEmail}`;

  // Stream the response as SSE.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(chunk: string) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
        );
      }

      let turn = 0;
      try {
        while (turn < MAX_AGENT_TURNS) {
          turn++;

          // Run tool-call turns synchronously (non-streaming) so tool
          // results are available before we stream the next response.
          const cachedTools =
            tools.length > 0
              ? [
                  ...tools.slice(0, -1),
                  {
                    ...tools[tools.length - 1],
                    cache_control: { type: "ephemeral" as const },
                  },
                ]
              : tools;

          // Use streaming only on the final text response turn.
          // We determine whether this is a "tool turn" by doing a
          // non-streaming call first. If it ends in tool_use we process
          // tools; if it ends in end_turn we stream.
          const response = await anthropic.messages.create({
            model: MODEL_ID,
            max_tokens: 2048,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: cachedTools as any,
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const u = response.usage as any;
          totalInputTokens += (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0);
          totalCacheCreateTokens += u?.cache_creation_input_tokens ?? 0;
          totalCacheReadTokens += u?.cache_read_input_tokens ?? 0;
          totalOutputTokens += u?.output_tokens ?? 0;

          messages.push({ role: "assistant", content: response.content });

          if (response.stop_reason === "end_turn") {
            // Stream the text content.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const textBlocks = response.content.filter((b: any) => b.type === "text");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const block of textBlocks) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              emit((block as any).text ?? "");
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            finalText = textBlocks.map((b: any) => (b as any).text).join("\n");
            break;
          }

          if (response.stop_reason === "tool_use") {
            // Execute all tool calls in this turn.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResults: any[] = [];
            for (const block of response.content) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const b = block as any;
              if (b.type !== "tool_use") continue;
              toolsCalledNames.push(String(b.name));
              const result = await executeAgentApiTool({
                tool_use_id: b.id,
                name: b.name,
                input: (b.input ?? {}) as Record<string, unknown>,
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: result.tool_use_id,
                content: result.content,
                is_error: result.is_error,
              });
            }
            messages.push({ role: "user", content: toolResults });
            continue;
          }

          // Unknown stop_reason — emit any text and stop.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textBlocks = response.content.filter((b: any) => b.type === "text");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finalText = textBlocks.map((b: any) => (b as any).text).join("\n");
          if (finalText) emit(finalText);
          else agentError = `stopped with reason ${response.stop_reason}`;
          break;
        }

        if (!finalText && !agentError) {
          agentError = `no final reply after ${turn} turn(s)`;
          emit(`(sorry — I ran into a problem: ${agentError})`);
        }
      } catch (err) {
        agentError = err instanceof Error ? err.message : "unknown error";
        console.warn("[chat] agent error:", agentError);
        emit(`(sorry — I ran into a problem: ${agentError})`);
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();

      // Persist messages and audit after stream closes (fire-and-forget).
      const trimmedMsg = message.trim();
      void appendMessage(chatThreadKey, { role: "user", content: trimmedMsg });
      if (finalText) {
        void appendMessage(chatThreadKey, { role: "assistant", content: finalText });
      }

      const durationMs = Date.now() - startMs;
      const pricing = MODEL_PRICING[MODEL_ID];
      const baseInputTokens = totalInputTokens - totalCacheCreateTokens - totalCacheReadTokens;
      const costUsd =
        (baseInputTokens / 1_000_000) * pricing.input +
        (totalCacheCreateTokens / 1_000_000) * pricing.input * 1.25 +
        (totalCacheReadTokens / 1_000_000) * pricing.input * 0.10 +
        (totalOutputTokens / 1_000_000) * pricing.output;

      auditTurn({
        eventId,
        userEmail,
        displayName,
        toolsCalledNames,
        finalReply: finalText || agentError || "",
        errorMessage: agentError,
        durationMs,
        turnCount: turn,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd,
        modelId: MODEL_ID,
        cacheCreationInputTokens: totalCacheCreateTokens,
        cacheReadInputTokens: totalCacheReadTokens,
      }).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

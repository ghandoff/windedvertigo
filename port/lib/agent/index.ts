/**
 * Port agent — Slack event → Claude turn → Slack DM reply.
 *
 * This is the PR C scope: the agent loop itself. Includes:
 *   - user resolution (lib/agent/user-mapping)
 *   - per-user scope (lib/agent/user-scope)
 *   - tool whitelist + execution (lib/agent/tools/*)
 *   - Claude via AI Gateway (env-routed via `new Anthropic()`)
 *   - bounded agentic loop (MAX_AGENT_TURNS + wall-clock deadline)
 *   - DM reply via slackAgentApi (uses SLACK_AGENT_BOT_TOKEN)
 *
 * Deliberately NOT in this file:
 *   - waitUntil wiring (PR E — lives in the webhook route handler)
 */

import Anthropic from "@anthropic-ai/sdk";

import { resolveUser } from "./user-mapping";
import { getUserScope } from "./user-scope";
import { slackAgentApi } from "./slack-agent-api";
import { AGENT_TOOLS } from "./tools/definitions";
import { executeTool } from "./tools/executor";
import { auditTurn, auditRejection, hasAuditedEvent } from "./audit";
import type { AgentToolName } from "./types";

const MAX_AGENT_TURNS = 5;
const AGENT_TIMEOUT_MS = 20_000;
const MODEL_ID = "claude-sonnet-4-6";

// `new Anthropic()` reads ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL env vars,
// which on Vercel prod + dev point at the AI Gateway (vck_ key + gateway URL).
const anthropic = new Anthropic();

interface SlackEventPayload {
  type?: string;
  event_id?: string;
  event?: {
    type?: string;
    user?: string;
    text?: string;
    channel?: string;
    bot_id?: string;
  };
}

/** Open a DM channel with the user and post a plain-text message. Best-effort. */
async function sendAgentDm(slackUserId: string, text: string): Promise<void> {
  try {
    const openRes = await slackAgentApi({
      method: "conversations.open",
      body: { users: slackUserId },
    });
    const channelId: string | undefined = openRes?.channel?.id;
    if (!channelId) {
      console.warn("[agent] conversations.open returned no channel id");
      return;
    }
    await slackAgentApi({
      method: "chat.postMessage",
      body: { channel: channelId, text },
    });
  } catch (err) {
    console.warn(
      "[agent] sendAgentDm failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Run one full agent turn for a Slack event. Safe to call from `waitUntil()`:
 * never throws, logs errors, and always attempts a reply to the user.
 */
export async function runAgentTurn(payload: SlackEventPayload): Promise<void> {
  const startMs = Date.now();
  const eventId = payload.event_id ?? "?";
  const ev = payload.event;

  // Ignore bot messages (including our own) to prevent loops.
  if (ev?.bot_id) return;
  if (!ev?.user || !ev.text) return;

  // Idempotency: Slack delivers events at-least-once and may retry if our
  // webhook ack didn't land. If we already have an audit row for this
  // event_id, skip — the user already got their reply.
  if (eventId !== "?" && (await hasAuditedEvent(eventId))) {
    console.log(`[agent] eventId=${eventId} already processed — skipping retry`);
    return;
  }

  // Step 1: resolve Slack user → Auth.js email
  const user = await resolveUser(ev.user);
  if (!user) {
    await sendAgentDm(
      ev.user,
      "I can't find a port account linked to your Slack profile. Contact Garrett to get access.",
    );
    console.warn(`[agent] eventId=${eventId} unresolved user ${ev.user}`);
    auditRejection(eventId, `unresolved Slack user ${ev.user}`).catch(() => {});
    return;
  }

  // Step 2: resolve user scope
  const scope = getUserScope(user.email);
  if (!scope) {
    await sendAgentDm(
      ev.user,
      `Hi ${user.displayName}, you're recognized but don't have agent access yet. Ping Garrett.`,
    );
    console.warn(`[agent] eventId=${eventId} no scope for ${user.email}`);
    auditRejection(eventId, `no scope for ${user.email}`).catch(() => {});
    return;
  }

  // Step 3: run bounded agentic loop
  const allowedDefs = AGENT_TOOLS.filter((t) =>
    scope.allowedTools.includes(t.name as AgentToolName),
  );

  const systemPrompt =
    `You are the Winded Vertigo port agent — the operational copilot for the w.v collective. ` +
    `You are helping ${scope.displayName} (${scope.authEmail}) via Slack.\n\n` +
    `Data model:\n` +
    `- organizations: clients, partners, and prospects (getOrganization, queryContacts)\n` +
    `- contacts: people at organizations (queryContacts)\n` +
    `- deals: revenue pipeline — identified→pitched→proposal→won/lost (queryDeals, updateDeal)\n` +
    `- campaigns: outreach sequences with steps (queryCampaigns, updateCampaignStatus, createCampaign)\n` +
    `- projects: active and upcoming client engagements (queryProjects)\n` +
    `- RFPs: procurement opportunities — radar→pursuing→submitted→won/lost (queryRfpOpportunities)\n` +
    `- activities: meeting/call/email log against orgs and contacts (queryActivities, logActivity)\n` +
    `- work items: tasks and subtasks (queryWorkItems)\n` +
    `- timesheets: time entries with billable tracking (queryTimesheets, logTimeEntry)\n` +
    `- events: conferences and external events (queryEvents)\n` +
    `- members: active w.v collective team (queryMembers)\n\n` +
    `Read tools (query*/get*) return data immediately. ` +
    `Write tools (log*, create*, update*) stage an action for confirmation — ` +
    `describe the pending change to ${scope.displayName} and ask them to reply "confirm" before executing. ` +
    `Call confirmAction only after explicit affirmation. ` +
    `Only call ONE write tool per turn. Never invent IDs — look them up first.\n\n` +
    `Style: concise, grounded in tool output. Use display names not IDs. ` +
    `Summarize lists > 5 items rather than enumerating all. ` +
    `You have ${allowedDefs.length} tools available.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content: ev.text }];

  let turn = 0;
  let finalText = "";
  let agentError: string | null = null;
  const toolsCalledNames: string[] = [];

  try {
    while (turn < MAX_AGENT_TURNS) {
      if (Date.now() - startMs > AGENT_TIMEOUT_MS) {
        agentError = "agent turn timed out";
        break;
      }
      turn++;

      const response = await anthropic.messages.create({
        model: MODEL_ID,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: allowedDefs as any,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        finalText = response.content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((b: any) => b.type === "text")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((b: any) => b.text)
          .join("\n");
        break;
      }

      if (response.stop_reason === "tool_use") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolResults: any[] = [];
        for (const block of response.content) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const b = block as any;
          if (b.type !== "tool_use") continue;
          toolsCalledNames.push(String(b.name));
          const result = await executeTool(
            {
              tool_use_id: b.id,
              name: b.name,
              input: (b.input ?? {}) as Record<string, unknown>,
            },
            scope,
          );
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

      // Unknown stop_reason (max_tokens, stop_sequence, etc.) — break.
      finalText = response.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("\n");
      if (!finalText) agentError = `stopped with reason ${response.stop_reason}`;
      break;
    }

    if (!finalText && !agentError) {
      agentError = `no final reply after ${turn} turn(s)`;
    }
  } catch (err) {
    agentError = err instanceof Error ? err.message : "unknown error";
    console.warn(`[agent] eventId=${eventId} caught error:`, agentError);
  }

  // Step 4: reply to user
  const reply =
    finalText || `Sorry — I ran into a problem handling that: ${agentError ?? "no response"}.`;
  await sendAgentDm(ev.user, reply);

  // Step 5: audit the turn (fire-and-forget, never throws).
  const durationMs = Date.now() - startMs;
  auditTurn({
    eventId,
    userEmail: scope.authEmail,
    displayName: scope.displayName,
    toolsCalledNames,
    finalReply: reply,
    errorMessage: agentError,
    durationMs,
    turnCount: turn,
  }).catch(() => {});
}

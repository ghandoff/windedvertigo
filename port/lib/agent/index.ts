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
import { MODEL_PRICING, type ModelId } from "@/lib/ai/types";
import {
  getRecentMessages,
  appendMessage,
} from "@/lib/supabase/agent-thread-messages";
import { getRecentSpendByUser } from "@/lib/supabase/agent-actions";

// Per-user daily spend cap. Configurable via env. Default $5/user/day:
// generous enough that legitimate usage never trips it, low enough that
// a runaway tool loop or hostile interaction gets shut down within ~$50.
const DAILY_BUDGET_USD = parseFloat(process.env.WV_CLAW_DAILY_BUDGET_USD ?? "5");
// Per-turn warning threshold — if a single turn costs more than this, we
// log a WARN line so `wrangler tail | grep "high cost"` surfaces outliers.
const HIGH_COST_TURN_THRESHOLD_USD = 0.10;

const MAX_AGENT_TURNS = 5;
const AGENT_TIMEOUT_MS = 20_000;
const MODEL_ID: ModelId = "claude-sonnet-4-6";

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
    // W0.2: needed for thread-keyed conversation memory. `thread_ts` is
    // present when the message is in a Slack thread; otherwise we anchor on
    // the channel id (DM channel = a stable conversation between user + bot).
    ts?: string;
    thread_ts?: string;
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

  // Step 2.5: per-user daily budget guard. Skip cheaply if the user's
  // recent spend exceeds DAILY_BUDGET_USD. Fail-open (the helper returns 0
  // on any error) so transient Supabase issues never block legitimate users.
  const recentSpend = await getRecentSpendByUser(scope.authEmail, 24);
  if (recentSpend >= DAILY_BUDGET_USD) {
    const overBy = (recentSpend - DAILY_BUDGET_USD).toFixed(2);
    await sendAgentDm(
      ev.user,
      `Hi ${scope.displayName} — you've hit today's wv-claw spend cap ($${DAILY_BUDGET_USD.toFixed(2)}; ` +
        `currently at $${recentSpend.toFixed(2)}, over by $${overBy}). resets at midnight UTC. ping Garrett if you need the cap raised.`,
    );
    console.warn(
      `[agent] eventId=${eventId} budget cap hit user=${scope.authEmail} spend=${recentSpend.toFixed(4)} cap=${DAILY_BUDGET_USD}`,
    );
    auditRejection(eventId, `daily budget cap hit: $${recentSpend.toFixed(4)} >= $${DAILY_BUDGET_USD}`).catch(() => {});
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
    `- members: active w.v collective team (queryMembers)\n` +
    `- meetings: Council meetings + AI summaries (queryMeetings)\n` +
    `- meeting actions: action items extracted from meetings, filterable by owner + status (getMeetingActions)\n` +
    `- marketing strategy: Q2-Q3 2026 strategy command centre — positioning, audience, channels, pipeline, distribution, timeline. Use readStrategyDoc(section) to read any section. CMO is Claude (AI role); sponsor is Garrett. Live at port.windedvertigo.com/strategy.\n\n` +
    `Read tools (query*/get*) return data immediately. ` +
    `Write tools (log*, create*, update*) stage an action for confirmation — ` +
    `describe the pending change to ${scope.displayName} and ask them to reply "confirm" before executing. ` +
    `Call confirmAction only after explicit affirmation. ` +
    `Only call ONE write tool per turn. Never invent IDs — look them up first.\n\n` +
    `Style: concise, grounded in tool output. Use display names not IDs. ` +
    `Summarize lists > 5 items rather than enumerating all. ` +
    `You have ${allowedDefs.length} tools available.`;

  // W0.2: load conversation memory for this thread (Slack thread_ts if
  // present, else channel id). Prepended before the current user message
  // so multi-turn DMs feel continuous instead of stateless.
  const threadKey = ev.thread_ts ?? ev.channel ?? `solo:${ev.user}`;
  const history = await getRecentMessages(threadKey, { limit: 10, withinMinutes: 60 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: ev.text },
  ];

  let turn = 0;
  let finalText = "";
  let agentError: string | null = null;
  const toolsCalledNames: string[] = [];
  // W0.1: accumulate token usage across multi-turn loop for audit cost tracking.
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  // W0.3 follow-up: track cache buckets separately for accurate weighted cost.
  let totalCacheCreateTokens = 0;
  let totalCacheReadTokens = 0;

  try {
    while (turn < MAX_AGENT_TURNS) {
      if (Date.now() - startMs > AGENT_TIMEOUT_MS) {
        agentError = "agent turn timed out";
        break;
      }
      turn++;

      // W0.3: prompt caching. Marking the system prompt + the last tool
      // definition with `cache_control: ephemeral` tells Anthropic to cache
      // everything up to those markers. First write of the cache costs
      // ~1.25× base; subsequent reads (within 5-min TTL) cost ~0.1× base.
      // Pays off the moment W0.2 thread memory triggers a second turn in
      // the same conversation.
      const cachedTools =
        allowedDefs.length > 0
          ? [
              ...allowedDefs.slice(0, -1),
              {
                ...allowedDefs[allowedDefs.length - 1],
                cache_control: { type: "ephemeral" as const },
              },
            ]
          : allowedDefs;

      const response = await anthropic.messages.create({
        model: MODEL_ID,
        max_tokens: 1024,
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

      // W0.3 follow-up: track cache buckets separately so we can compute
      // accurate weighted cost. Anthropic billing rates:
      //   input_tokens               — base rate
      //   cache_creation_input_tokens — 1.25x base (first write)
      //   cache_read_input_tokens     — 0.1x base (subsequent reads)
      // We still keep `totalInputTokens` (gross sum) for the input_tokens
      // column for backwards compat; cache buckets get their own columns.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = response.usage as any;
      const turnInput  = u?.input_tokens ?? 0;
      const turnCacheW = u?.cache_creation_input_tokens ?? 0;
      const turnCacheR = u?.cache_read_input_tokens ?? 0;
      totalInputTokens       += turnInput + turnCacheW + turnCacheR;
      totalCacheCreateTokens += turnCacheW;
      totalCacheReadTokens   += turnCacheR;
      totalOutputTokens      += u?.output_tokens ?? 0;

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

  // Step 5a (W0.2): persist this turn's user + assistant text to thread
  // memory so the next DM in the same thread/channel sees them as context.
  // Plain text only — we deliberately drop tool_use blocks because their
  // ids would be stale on replay. Fire-and-forget.
  void appendMessage(threadKey, { role: "user", content: ev.text }, ev.user);
  void appendMessage(threadKey, { role: "assistant", content: reply });

  // Step 5: audit the turn (fire-and-forget, never throws).
  const durationMs = Date.now() - startMs;
  const pricing = MODEL_PRICING[MODEL_ID];
  // Weighted cost: input_tokens at base rate; cache_creation at 1.25x;
  // cache_read at 0.1x. (totalInputTokens includes ALL three buckets, so
  // subtract the cache buckets before applying base rate to non-cached.)
  const baseInputTokens = totalInputTokens - totalCacheCreateTokens - totalCacheReadTokens;
  const costUsd =
    (baseInputTokens / 1_000_000) * pricing.input +
    (totalCacheCreateTokens / 1_000_000) * pricing.input * 1.25 +
    (totalCacheReadTokens / 1_000_000) * pricing.input * 0.10 +
    (totalOutputTokens / 1_000_000) * pricing.output;
  // Surface outlier-cost turns immediately so runaways are visible in `wrangler tail`.
  if (costUsd > HIGH_COST_TURN_THRESHOLD_USD) {
    console.warn(
      `[agent] high cost turn eventId=${eventId} user=${scope.authEmail} cost=$${costUsd.toFixed(4)} tokens=${totalInputTokens}in/${totalOutputTokens}out turns=${turn} tools=${toolsCalledNames.join(",")}`,
    );
  }
  auditTurn({
    eventId,
    userEmail: scope.authEmail,
    displayName: scope.displayName,
    toolsCalledNames,
    finalReply: reply,
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
}

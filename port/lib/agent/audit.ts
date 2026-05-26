/**
 * Agent audit logging + event-ID idempotency.
 *
 * Three sinks — all fail-open (never throw, never block the agent reply):
 *   1. Structured console.log: always active. Worker log drain captures it.
 *   2. Supabase persistence: PRIMARY since W0.1 (May 2026). Inserts a row
 *      per turn into agent_actions. Source of truth going forward.
 *   3. Notion persistence: LEGACY (safety net). Active when AGENT_AUDIT_DB_ID
 *      points at an `agent actions` data source. Will be retired after a
 *      ~1-week parallel-write trial confirms Supabase is reliable.
 *
 * Idempotency:
 *   hasAuditedEvent(eventId) queries Supabase first (fast, primary). Falls
 *   back to Notion only if Supabase errors. runAgentTurn calls this at start
 *   — if true, it skips. Dedupes Slack at-least-once webhook retries.
 */

import { notion } from "@/lib/notion/client";
import {
  insertAgentAction,
  hasAgentActionForEvent,
  type AgentActionStatus,
} from "@/lib/supabase/agent-actions";

export interface AuditEntry {
  eventId: string;
  userEmail: string;
  displayName: string;
  toolsCalledNames: string[];
  finalReply: string;
  errorMessage: string | null;
  durationMs: number;
  turnCount: number;
  // W0.1 additions — cost economics. Optional so callers that don't track
  // tokens (e.g. rejection path) can omit.
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  modelId?: string;
  // W0.3 follow-up — cache effectiveness tracking.
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

function classifyStatus(entry: AuditEntry): AgentActionStatus {
  if (!entry.errorMessage) return "success";
  if (entry.errorMessage.includes("timed out")) return "timeout";
  return "error";
}

/** Trim a string to fit Notion's 2000-char rich_text cap (with safety margin). */
function trim2000(s: string): string {
  return s.length > 1900 ? s.slice(0, 1900) + "…" : s;
}

export async function auditTurn(entry: AuditEntry): Promise<void> {
  // Step 1: structured console log.
  console.log(
    JSON.stringify({
      type: "agent_audit",
      eventId: entry.eventId,
      user: entry.userEmail,
      tools: entry.toolsCalledNames,
      turns: entry.turnCount,
      durationMs: entry.durationMs,
      error: entry.errorMessage,
      replyLength: entry.finalReply.length,
      costUsd: entry.costUsd,
      modelId: entry.modelId,
    }),
  );

  const status = classifyStatus(entry);
  const replyPreview = entry.finalReply.slice(0, 1800);

  // Step 2: Supabase (primary). Fire-and-forget — insertAgentAction is
  // fail-open internally.
  void insertAgentAction({
    eventId:       entry.eventId,
    userEmail:     entry.userEmail,
    displayName:   entry.displayName,
    status,
    toolsCalled:   entry.toolsCalledNames,
    turnCount:     entry.turnCount,
    durationMs:    entry.durationMs,
    replyPreview,
    errorMessage:  entry.errorMessage,
    inputTokens:   entry.inputTokens ?? null,
    outputTokens:  entry.outputTokens ?? null,
    costUsd:       entry.costUsd ?? null,
    modelId:       entry.modelId ?? null,
    cacheCreationInputTokens: entry.cacheCreationInputTokens ?? null,
    cacheReadInputTokens:     entry.cacheReadInputTokens ?? null,
  });

  // Step 3: Notion (legacy safety net). Skip silently if not configured —
  // this is how we'll retire the Notion path after the trial period.
  const dbId = process.env.AGENT_AUDIT_DB_ID;
  if (!dbId) return;

  try {
    const date = new Date().toISOString().slice(0, 10);
    const title = `agent turn — ${entry.displayName} — ${date}`;
    const notesJson = JSON.stringify({
      eventId: entry.eventId,
      replyPreview,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (notion as any).pages.create({
      parent: { data_source_id: dbId },
      properties: {
        Name: { title: [{ text: { content: title } }] },
        "Event ID": {
          rich_text: [{ text: { content: trim2000(entry.eventId) } }],
        },
        "User Email": {
          rich_text: [{ text: { content: trim2000(entry.userEmail) } }],
        },
        Tools: {
          rich_text: [
            { text: { content: trim2000(entry.toolsCalledNames.join(", ")) } },
          ],
        },
        Turns: { number: entry.turnCount },
        "Duration ms": { number: entry.durationMs },
        Status: { select: { name: status } },
        ...(entry.errorMessage
          ? {
              Error: {
                rich_text: [{ text: { content: trim2000(entry.errorMessage) } }],
              },
            }
          : {}),
        Notes: { rich_text: [{ text: { content: trim2000(notesJson) } }] },
      },
    });
  } catch (err) {
    console.warn(
      "[agent/audit] Notion write failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Record a rejection — when the agent drops an event before running the
 * loop (unknown user, no scope). Same fail-open contract as auditTurn.
 */
export async function auditRejection(
  eventId: string,
  reason: string,
): Promise<void> {
  console.log(
    JSON.stringify({
      type: "agent_audit",
      eventId,
      status: "rejected",
      reason,
    }),
  );

  // Step 2: Supabase. Use minimal entry — no user/tools/cost data for rejections.
  void insertAgentAction({
    eventId,
    userEmail:     "unknown",
    displayName:   "rejected",
    status:        "rejected",
    toolsCalled:   [],
    turnCount:     null,
    durationMs:    null,
    replyPreview:  null,
    errorMessage:  reason,
    inputTokens:   null,
    outputTokens:  null,
    costUsd:       null,
    modelId:       null,
  });

  // Step 3: Notion legacy.
  const dbId = process.env.AGENT_AUDIT_DB_ID;
  if (!dbId) return;

  try {
    const date = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (notion as any).pages.create({
      parent: { data_source_id: dbId },
      properties: {
        Name: { title: [{ text: { content: `agent turn — rejected — ${date}` } }] },
        "Event ID": {
          rich_text: [{ text: { content: trim2000(eventId) } }],
        },
        Status: { select: { name: "rejected" } },
        Error: { rich_text: [{ text: { content: trim2000(reason) } }] },
      },
    });
  } catch (err) {
    console.warn(
      "[agent/audit] Notion rejection write failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Idempotency check — has an audit row been written for this Event ID?
 *
 * Query Supabase first (primary). Fall back to Notion only if Supabase
 * returned false (could be either "not found" or "error"). Treats "don't
 * know" as "haven't seen" to avoid silently dropping legitimate events on
 * transient backend errors.
 */
export async function hasAuditedEvent(eventId: string): Promise<boolean> {
  // Primary: Supabase. Fast and reliable.
  if (await hasAgentActionForEvent(eventId)) return true;

  // Legacy fallback: Notion. Only meaningful during the parallel-write
  // trial; once we retire AGENT_AUDIT_DB_ID this branch is dead.
  const dbId = process.env.AGENT_AUDIT_DB_ID;
  if (!dbId) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (notion as any).dataSources.query({
      data_source_id: dbId,
      filter: {
        property: "Event ID",
        rich_text: { equals: eventId },
      },
      page_size: 1,
    });
    return (res.results?.length ?? 0) > 0;
  } catch (err) {
    console.warn(
      "[agent/audit] Notion idempotency check failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

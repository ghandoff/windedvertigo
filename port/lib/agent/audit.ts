/**
 * Agent audit logging + event-ID idempotency.
 *
 * Two sinks — both fail-open (never throw, never block the agent reply):
 *   1. Structured console.log: always active. Vercel's log drain captures it.
 *   2. Notion persistence: active when AGENT_AUDIT_DB_ID points at an
 *      `agent actions` data source. Writes a row per turn with all queryable
 *      columns (Event ID, User Email, Tools, Turns, Duration ms, Status,
 *      Error, Notes).
 *
 * Idempotency:
 *   hasAuditedEvent(eventId) queries the DB for an existing row with the
 *   same Event ID. runAgentTurn calls this at start — if true, it skips.
 *   This dedupes Slack webhook retries (Slack uses at-least-once delivery;
 *   it may resend the same event_id if our ack dropped).
 */

import { notion } from "@/lib/notion/client";

export interface AuditEntry {
  eventId: string;
  userEmail: string;
  displayName: string;
  toolsCalledNames: string[];
  finalReply: string;
  errorMessage: string | null;
  durationMs: number;
  turnCount: number;
}

type AuditStatus = "success" | "error" | "timeout" | "rejected";

function classifyStatus(entry: AuditEntry): AuditStatus {
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
    }),
  );

  const dbId = process.env.AGENT_AUDIT_DB_ID;
  if (!dbId) return;

  try {
    const date = new Date().toISOString().slice(0, 10);
    const title = `agent turn — ${entry.displayName} — ${date}`;
    const status = classifyStatus(entry);
    const notesJson = JSON.stringify({
      eventId: entry.eventId,
      replyPreview: entry.finalReply.slice(0, 1800),
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
 * Returns false if the DB isn't configured, if the query fails, or if no
 * match is found. Callers should treat "don't know" as "haven't seen" to
 * avoid silently dropping legitimate events on transient Notion errors.
 * A double-run is recoverable (user sees two replies); a missed-run is
 * worse (user sees nothing).
 */
export async function hasAuditedEvent(eventId: string): Promise<boolean> {
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

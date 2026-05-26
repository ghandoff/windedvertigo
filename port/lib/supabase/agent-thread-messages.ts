/**
 * Supabase read/write for wv-claw conversation memory (W0.2).
 *
 * Loads the last N messages for a Slack thread/channel so the agent has
 * context across sequential DMs. Without this, every turn is stateless and
 * the user feels like they're talking to a goldfish.
 *
 * Read shape: an array of { role, content } pairs ready to prepend to the
 * current turn's messages[] before calling Anthropic. We deliberately store
 * + return plain-text content only — replaying full assistant tool_use
 * blocks across turns would break because tool_use_ids are stale.
 *
 * Fail-open: read errors return an empty array, write errors log and swallow.
 * Conversation memory is a nice-to-have; an agent that forgets context is
 * better than an agent that crashes.
 */

import { supabase } from "./client";

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Returns the most recent messages for a thread, oldest first (so the array
 * is in conversation order, ready to spread into messages[]).
 *
 * Defaults: 10 messages from the last 60 minutes. Tune limits as needed.
 */
export async function getRecentMessages(
  threadKey: string,
  opts: { limit?: number; withinMinutes?: number } = {},
): Promise<ThreadMessage[]> {
  const limit = opts.limit ?? 10;
  const withinMinutes = opts.withinMinutes ?? 60;
  const sinceIso = new Date(Date.now() - withinMinutes * 60_000).toISOString();

  try {
    const { data, error } = await supabase
      .from("agent_thread_messages")
      .select("role, content, created_at")
      .eq("thread_key", threadKey)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[supabase/agent-thread-messages] read failed:", error.message);
      return [];
    }
    // We selected DESC; reverse so the array reads in chronological order.
    return (data ?? [])
      .reverse()
      .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  } catch (err) {
    console.warn(
      "[supabase/agent-thread-messages] read threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/** Append a new message to the thread. Fail-open. */
export async function appendMessage(
  threadKey: string,
  message: ThreadMessage,
  slackUserId?: string,
): Promise<void> {
  try {
    const { error } = await supabase.from("agent_thread_messages").insert({
      thread_key: threadKey,
      role: message.role,
      content: message.content,
      slack_user_id: slackUserId ?? null,
    });
    if (error) {
      console.warn("[supabase/agent-thread-messages] write failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[supabase/agent-thread-messages] write threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

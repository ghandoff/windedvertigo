/**
 * POST /api/agent/slack/events
 *
 * Receives Slack Events API webhooks for the port agent.
 * Verifies the Slack signing secret, then routes events.
 *
 *   - URL verification handshake (run once at Slack app setup)
 *   - Signature validation (HMAC SHA-256 + timestamp skew rejection,
 *     lib/slack-verify.ts — shared with the interactive endpoint)
 *   - app_mention / DM events → the conversational agent loop (runAgentTurn),
 *     after() the 200 ack so Slack's 3s budget is respected
 *   - channel messages (not DMs) on the ambient-rollout watch-list →
 *     event_log, for the agent-ambient-sweep cron to debounce/batch
 *     (docs/prompts/executive-agents-phase1-build.md §2.1). Requires the
 *     `message.channels` event subscription + channels:history/channels:read
 *     scopes on the wv-claw Slack app — not auto-granted, a human gate.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { runAgentTurn } from "@/lib/agent";
import { verifySlackSignature } from "@/lib/slack-verify";
import { insertEventLogRow } from "@/lib/supabase/event-log";
import { ambientWatchedChannelIds } from "@/lib/agent/ambient-rollout";

interface SlackEvent {
  type?: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
  ts?: string;
}

interface SlackEventPayload {
  type?: string;
  challenge?: string;
  event?: SlackEvent;
  team_id?: string;
  event_id?: string;
}

/**
 * Write a channel message to event_log if its channel is on the current
 * rollout stage's watch-list. Runs inside after() — never on the hot ack
 * path. No agent run happens here; the agent-ambient-sweep cron (every 5
 * min) reads unprocessed rows and applies the quiet-window/high-signal
 * debounce before invoking any agent.
 */
async function ingestChannelMessage(ev: SlackEvent): Promise<void> {
  const watched = await ambientWatchedChannelIds();
  if (!watched.has(ev.channel!)) return;
  await insertEventLogRow({
    source: "slack",
    type: ev.type ?? "message",
    channel: ev.channel!,
    payload: { user: ev.user, text: ev.text, ts: ev.ts, channel_type: ev.channel_type },
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Slack registration handshake — echo the challenge back.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Normal event callback — ack immediately, dispatch agent work after the response.
  if (payload.type === "event_callback") {
    const ev = payload.event;
    const eventId = payload.event_id ?? "?";

    // Filter to events the agent should act on:
    //   - app_mention: someone @-mentioned the bot in a channel
    //   - message with channel_type=im (DM to the bot), excluding message
    //     subtypes (message_changed, message_deleted) and bot-authored messages
    //     to prevent loops.
    const isAppMention = ev?.type === "app_mention";
    const isDirectMessage =
      ev?.type === "message" && ev?.channel_type === "im" && !ev?.subtype;
    const isBotMessage = !!ev?.bot_id;
    // Ambient-spine ingestion: channel messages (not DMs), for the
    // agent-ambient-sweep cron to debounce/batch. Distinct from the
    // conversational app_mention/DM path above — this never calls
    // runAgentTurn directly (docs/prompts/executive-agents-phase1-build.md §2.1).
    const isChannelMessage =
      ev?.type === "message" && ev?.channel_type !== "im" && !ev?.subtype;

    if (!isBotMessage && (isAppMention || isDirectMessage)) {
      console.log(
        `[slack/events] dispatch ${ev?.type} user=${ev?.user ?? "?"} channel=${ev?.channel ?? "?"} event_id=${eventId}`,
      );
      // after() keeps the function alive past the 200 response so the
      // agent turn can run — Slack gets its 3s ack; the agent takes as
      // long as it needs (bounded internally by MAX_AGENT_TURNS +
      // AGENT_TIMEOUT_MS).
      after(runAgentTurn(payload));
    } else if (!isBotMessage && isChannelMessage && ev?.channel) {
      after(ingestChannelMessage(ev));
    } else {
      console.log(
        `[slack/events] skip ${ev?.type ?? "?"} channel_type=${ev?.channel_type ?? "?"} bot_id=${ev?.bot_id ?? "none"} subtype=${ev?.subtype ?? "none"} event_id=${eventId}`,
      );
    }

    return NextResponse.json({ ok: true });
  }

  // Unknown payload type — ack so Slack doesn't retry.
  return NextResponse.json({ ok: true });
}

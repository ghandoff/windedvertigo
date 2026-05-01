/**
 * POST /api/agent/slack/events
 *
 * Receives Slack Events API webhooks for the port agent.
 * Verifies the Slack signing secret, then routes events.
 *
 * Phase 0 (this commit):
 *   - URL verification handshake (run once at Slack app setup)
 *   - Signature validation (HMAC SHA-256 + timestamp skew rejection)
 *   - Synchronous 200 ack; no agent work yet
 *
 * Phase 1+ (later commits):
 *   - Dispatch `app_mention` and `message.im` events to the agent loop
 *   - Use waitUntil() from @vercel/functions to do agent work after ack,
 *     staying under Slack's 3-second response requirement
 */

import { NextRequest, NextResponse, after } from "next/server";
import crypto from "node:crypto";
import { runAgentTurn } from "@/lib/agent";

// Slack's recommended skew window for replay protection.
const MAX_TIMESTAMP_SKEW_SEC = 60 * 5;

function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[slack/events] SLACK_SIGNING_SECRET not set — rejecting");
      return false;
    }
    console.warn(
      "[slack/events] SLACK_SIGNING_SECRET not set — skipping verification (dev only)",
    );
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_SKEW_SEC) {
    console.warn("[slack/events] timestamp skew too large — rejecting");
    return false;
  }

  const basestring = `v0:${timestamp}:${rawBody}`;
  const expected =
    "v0=" +
    crypto.createHmac("sha256", secret).update(basestring).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

interface SlackEvent {
  type?: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
}

interface SlackEventPayload {
  type?: string;
  challenge?: string;
  event?: SlackEvent;
  team_id?: string;
  event_id?: string;
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

    if (!isBotMessage && (isAppMention || isDirectMessage)) {
      console.log(
        `[slack/events] dispatch ${ev?.type} user=${ev?.user ?? "?"} channel=${ev?.channel ?? "?"} event_id=${eventId}`,
      );
      // after() keeps the function alive past the 200 response so the
      // agent turn can run — Slack gets its 3s ack; the agent takes as
      // long as it needs (bounded internally by MAX_AGENT_TURNS +
      // AGENT_TIMEOUT_MS).
      after(runAgentTurn(payload));
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

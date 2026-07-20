/**
 * Slack request signature verification — shared by every Slack-facing
 * route (Events API, Interactivity). Extracted from
 * app/api/agent/slack/events/route.ts, which previously had this as a
 * module-private function; the new interactive endpoint
 * (app/api/agent/slack/interactive/route.ts) needs the identical check.
 *
 * Works unchanged for both request shapes: Events API sends raw JSON,
 * Interactivity sends `application/x-www-form-urlencoded` with a
 * `payload=` field — Slack signs the raw body either way, so this function
 * doesn't need to know or care which.
 */

import crypto from "node:crypto";

// Slack's recommended skew window for replay protection.
const MAX_TIMESTAMP_SKEW_SEC = 60 * 5;

export function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[slack-verify] SLACK_SIGNING_SECRET not set — rejecting");
      return false;
    }
    console.warn(
      "[slack-verify] SLACK_SIGNING_SECRET not set — skipping verification (dev only)",
    );
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_SKEW_SEC) {
    console.warn("[slack-verify] timestamp skew too large — rejecting");
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

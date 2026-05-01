/**
 * Shared feedback API handler.
 *
 * Each app creates a thin route file:
 *   import { createFeedbackHandler } from "@windedvertigo/feedback/api-handler";
 *   export const POST = createFeedbackHandler("orbit-lab");
 *
 * Stores feedback in the harbour_feedback Postgres table.
 * Optionally pings a Slack webhook if SLACK_FEEDBACK_WEBHOOK_URL is set.
 */

import { NextResponse } from "next/server";
import type { FeedbackPayload } from "./types";

export function createFeedbackHandler(defaultAppSlug: string) {
  return async function POST(request: Request) {
    try {
      const body = (await request.json()) as Partial<FeedbackPayload>;

      const app_slug = body.app_slug || defaultAppSlug;
      const { route, feedback_type, severity, comment, device_info } = body;

      if (!feedback_type || !severity || severity < 1 || severity > 5) {
        return NextResponse.json(
          { error: "feedback_type and severity (1-5) are required" },
          { status: 400 },
        );
      }

      // store in postgres if POSTGRES_URL is available
      if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL!);
        await sql`
          INSERT INTO harbour_feedback (app_slug, route, feedback_type, severity, comment, device_info)
          VALUES (${app_slug}, ${route || null}, ${feedback_type}, ${severity}, ${comment || null}, ${JSON.stringify(device_info || {})})
        `;
      } else {
        // log to stdout as fallback (visible in Vercel function logs)
        console.log("[feedback]", JSON.stringify({ app_slug, route, feedback_type, severity, comment, device_info }));
      }

      // optional slack notification (supports webhook URL or bot token)
      const slackUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
      const slackToken = process.env.SLACK_BOT_TOKEN;
      const slackChannel = process.env.SLACK_FEEDBACK_CHANNEL;

      const icon = feedback_type === "bug" ? "🔴" : feedback_type === "confusing" ? "🟡" : feedback_type === "idea" ? "💡" : "💬";
      const text = `${icon} *[${app_slug}]* ${feedback_type} (${severity}/5)${comment ? `\n> ${comment}` : ""}`;

      if (slackUrl) {
        fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }).catch(() => {});
      } else if (slackToken && slackChannel) {
        fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${slackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel: slackChannel, text }),
        }).catch(() => {});
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[feedback] error:", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
  };
}

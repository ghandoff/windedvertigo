/**
 * Cron: weekly digest email.
 *
 * Runs every Monday at 8am UTC via Vercel cron. Sends a summary of
 * all activity from the past week to each tree member who has the
 * digest preference enabled.
 */

import { NextRequest } from "next/server";
import {
  getActiveTreeIds,
  getActivitySince,
  getNotificationRecipients,
  digestAlreadySentThisWeek,
  recordNotificationSend,
  getWeekStart,
} from "@/lib/db/notifications";
import { sendWeeklyDigestEmail } from "@/lib/email-notifications";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const weekStart = getWeekStart();
  const activeTreeIds = await getActiveTreeIds(weekStart);
  let sent = 0;

  for (const treeId of activeTreeIds) {
    try {
      const recipients = await getNotificationRecipients(treeId, "digest");
      const activities = await getActivitySince(treeId, weekStart);

      if (activities.length === 0) continue;

      for (const recipient of recipients) {
        try {
          const alreadySent = await digestAlreadySentThisWeek(
            treeId,
            recipient.email,
            weekStart
          );
          if (alreadySent) continue;

          await sendWeeklyDigestEmail({
            to: recipient.email,
            treeName: recipient.tree_name ?? "family tree",
            treeId,
            activities,
            weekStart,
          });

          await recordNotificationSend(
            treeId,
            recipient.email,
            "digest",
            weekStart
          );
          sent++;
        } catch (err) {
          console.error(
            `failed to send digest to ${recipient.email}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error(`failed to process digest for tree ${treeId}:`, err);
    }
  }

  return Response.json({ sent, trees: activeTreeIds.length });
}

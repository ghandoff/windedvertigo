/**
 * Cron: immediate activity notifications (debounced).
 *
 * Runs every 5 minutes via Vercel cron. Picks up trees where the last
 * edit was > 5 min ago, batches all recent activity into one email
 * per recipient, then clears the queue.
 */

import { NextRequest } from "next/server";
import {
  getPendingNotifications,
  getActivitySince,
  getNotificationRecipients,
  clearNotificationQueue,
} from "@/lib/db/notifications";
import { sendActivitySummaryEmail } from "@/lib/email-notifications";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const pending = await getPendingNotifications(5);
  let processed = 0;
  let emailsSent = 0;

  for (const item of pending) {
    try {
      const activities = await getActivitySince(
        item.tree_id,
        new Date(item.first_activity_at)
      );

      if (activities.length === 0) {
        await clearNotificationQueue(item.tree_id);
        continue;
      }

      const recipients = await getNotificationRecipients(
        item.tree_id,
        "immediate",
        item.last_actor_email ?? undefined
      );

      for (const recipient of recipients) {
        try {
          await sendActivitySummaryEmail({
            to: recipient.email,
            treeName: item.tree_name ?? "family tree",
            treeId: item.tree_id,
            activities,
          });
          emailsSent++;
        } catch (err) {
          console.error(
            `failed to send activity email to ${recipient.email}:`,
            err
          );
        }
      }

      await clearNotificationQueue(item.tree_id);
      processed++;
    } catch (err) {
      console.error(
        `failed to process notifications for tree ${item.tree_id}:`,
        err
      );
    }
  }

  return Response.json({ processed, emailsSent, queued: pending.length });
}

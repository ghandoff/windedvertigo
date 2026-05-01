/**
 * Inngest background job: notify team members when timesheet status changes.
 *
 * Triggers:
 *   - submitted → approved: email submitter + Slack
 *   - submitted → draft (rejected): email submitter + Slack
 *   - any status change: Slack summary
 *
 * Steps:
 * 1. Fetch the timesheet record
 * 2. Look up the submitter (person) from the members data layer
 * 3. Send email notification via Resend
 * 4. Post Slack summary
 */

import { inngest } from "@/lib/inngest/client";
import { getTimesheet } from "@/lib/notion/timesheets";
import { getActiveMembers } from "@/lib/notion/members";
import { sendOutreachEmail } from "@/lib/email/resend";
import { postToSlack } from "@/lib/slack";

const CRM_URL = "https://port.windedvertigo.com";

function formatHours(hours: number | null, minutes: number | null): string {
  const h = hours ?? 0;
  const m = minutes ?? 0;
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const timesheetNotificationFunction = inngest.createFunction(
  {
    id: "timesheet-status-notification",
    name: "Timesheet Status Notification",
    triggers: [{ event: "timesheet/status.changed" as const }],
  },
  async ({ event, step }) => {
    const { timesheetId, newStatus, previousStatus, approverEmail } = event.data;

    // 1. Fetch the timesheet
    const timesheet = await step.run("fetch-timesheet", () =>
      getTimesheet(timesheetId),
    );

    // 2. Look up submitter from members
    const submitter = await step.run("lookup-submitter", async () => {
      const members = await getActiveMembers();
      // Match by personIds relation — member IDs correspond to Notion page IDs
      const match = members.find((m) =>
        timesheet.personIds.includes(m.id),
      );
      return match ?? null;
    });

    const submitterName = submitter?.name ?? "Unknown";
    const submitterEmail = submitter?.email;
    const entryLabel = timesheet.entry || "Untitled entry";
    const hoursLabel = formatHours(timesheet.hours, timesheet.minutes);
    const dateLabel = formatDate(timesheet.dateAndTime?.start);

    // 3. Send email for key transitions
    if (submitterEmail && (newStatus === "approved" || newStatus === "draft")) {
      await step.run("send-email", async () => {
        const isApproval = newStatus === "approved";
        const subject = isApproval
          ? `Timesheet approved: ${entryLabel} (${hoursLabel})`
          : `Timesheet returned: ${entryLabel}`;

        const html = buildNotificationEmail({
          isApproval,
          entryLabel,
          hoursLabel,
          dateLabel,
          approverEmail,
          billable: timesheet.billable,
          explanation: timesheet.explanation,
        });

        const text = isApproval
          ? `Your timesheet "${entryLabel}" (${hoursLabel} on ${dateLabel}) has been approved by ${approverEmail}.`
          : `Your timesheet "${entryLabel}" has been returned to draft by ${approverEmail}. Please review and resubmit.`;

        await sendOutreachEmail({
          to: submitterEmail,
          subject,
          html,
          text,
          tags: [
            { name: "type", value: "timesheet-notification" },
            { name: "status", value: newStatus },
          ],
        });
      });
    }

    // 4. Post Slack summary for all status changes
    await step.run("post-slack", async () => {
      const emojiMap: Record<string, string> = {
        approved: ":white_check_mark:",
        submitted: ":inbox_tray:",
        invoiced: ":receipt:",
        paid: ":moneybag:",
        draft: ":pencil2:",
      };
      const emoji = emojiMap[newStatus] ?? ":arrows_counterclockwise:";

      const transition = previousStatus
        ? `${previousStatus} → ${newStatus}`
        : newStatus;

      await postToSlack(
        `${emoji} *Timesheet ${transition}*: ${entryLabel} (${hoursLabel}, ${dateLabel})\n` +
        `    _${submitterName}_ · ${timesheet.billable ? "billable" : "non-billable"}` +
        (approverEmail ? ` · by ${approverEmail}` : ""),
      );
    });

    return { notified: submitterEmail ?? "no-email", status: newStatus };
  },
);

// ── email template ──────────────────────────────────────

function buildNotificationEmail(params: {
  isApproval: boolean;
  entryLabel: string;
  hoursLabel: string;
  dateLabel: string;
  approverEmail: string;
  billable: boolean;
  explanation: string;
}): string {
  const { isApproval, entryLabel, hoursLabel, dateLabel, approverEmail, billable, explanation } = params;

  const statusColor = isApproval ? "#16a34a" : "#d97706";
  const statusLabel = isApproval ? "Approved" : "Returned to Draft";
  const statusMessage = isApproval
    ? "Your timesheet entry has been approved."
    : "Your timesheet entry has been returned to draft. Please review and resubmit.";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="padding:24px 24px 0;">
      <div style="display:inline-block;padding:4px 12px;border-radius:99px;background:${statusColor}15;color:${statusColor};font-size:13px;font-weight:600;">
        ${statusLabel}
      </div>
      <h2 style="margin:16px 0 4px;font-size:18px;color:#111827;">${entryLabel}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">${statusMessage}</p>
    </div>
    <div style="padding:0 24px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:100px;">Hours</td>
          <td style="padding:8px 0;color:#111827;font-weight:500;">${hoursLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Date</td>
          <td style="padding:8px 0;color:#111827;">${dateLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Billable</td>
          <td style="padding:8px 0;color:#111827;">${billable ? "Yes" : "No"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;">${isApproval ? "Approved by" : "Returned by"}</td>
          <td style="padding:8px 0;color:#111827;">${approverEmail}</td>
        </tr>
        ${explanation ? `
        <tr>
          <td style="padding:8px 0;color:#6b7280;vertical-align:top;">Notes</td>
          <td style="padding:8px 0;color:#111827;">${explanation}</td>
        </tr>
        ` : ""}
      </table>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <a href="${CRM_URL}/work/time" style="color:#2563eb;font-size:13px;text-decoration:none;">View timesheets →</a>
    </div>
  </div>
</body>
</html>`.trim();
}

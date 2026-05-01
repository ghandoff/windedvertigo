/**
 * POST /api/invoices/send — send invoice email + mark timesheets as invoiced.
 *
 * Steps:
 * 1. Re-resolve invoice data (ensures consistency)
 * 2. Build branded HTML
 * 3. Send via Resend
 * 4. Batch-update timesheets to "invoiced" status
 * 5. Post Slack confirmation
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import {
  resolveInvoiceData,
  buildInvoiceHtml,
} from "@/lib/invoice/generate-invoice-data";
import { sendOutreachEmail } from "@/lib/email/resend";
import { htmlToPlainText } from "@/lib/email/templates";
import { updateTimesheet } from "@/lib/notion/timesheets";
import { postToSlack } from "@/lib/slack";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return error("Unauthorized", 401);

  const body = await req.json();
  const {
    projectId,
    startDate,
    endDate,
    invoiceNumber,
    recipientEmail,
  } = body;

  if (!projectId || !startDate || !endDate || !invoiceNumber || !recipientEmail) {
    return error(
      "projectId, startDate, endDate, invoiceNumber, and recipientEmail are required",
      400,
    );
  }

  try {
    // 1. Resolve invoice data
    const invoiceData = await resolveInvoiceData(projectId, startDate, endDate);

    if (invoiceData.lineItems.length === 0) {
      return error("No approved billable timesheets found for this project and period", 400);
    }

    // Override the generated number with the user's chosen number
    invoiceData.invoiceNumber = invoiceNumber;

    // 2. Build HTML
    const html = buildInvoiceHtml(invoiceData);

    const formatCurrency = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    // 3. Send email
    await sendOutreachEmail({
      to: recipientEmail,
      subject: `Invoice ${invoiceNumber} — ${invoiceData.project.name} (${formatCurrency(invoiceData.total)})`,
      html,
      text: htmlToPlainText(html),
      tags: [
        { name: "type", value: "invoice" },
        { name: "invoice", value: invoiceNumber },
      ],
    });

    // 4. Batch-update timesheets to "invoiced"
    const updateResults = await Promise.allSettled(
      invoiceData.timesheetIds.map((id) =>
        updateTimesheet(id, { status: "invoiced" }),
      ),
    );

    const failedUpdates = updateResults.filter((r) => r.status === "rejected").length;

    // 5. Post Slack confirmation
    await postToSlack(
      `:receipt: *Invoice sent* — ${invoiceNumber}\n` +
        `    ${invoiceData.project.name} · ${formatCurrency(invoiceData.total)} · ${invoiceData.totalHours.toFixed(1)}h\n` +
        `    Sent to ${recipientEmail} by ${session.user.email ?? "unknown"}` +
        (failedUpdates > 0
          ? `\n    :warning: ${failedUpdates} timesheet${failedUpdates > 1 ? "s" : ""} failed to update to "invoiced"`
          : ""),
    );

    return json({
      sent: true,
      invoiceNumber,
      total: invoiceData.total,
      timesheetsUpdated: invoiceData.timesheetIds.length - failedUpdates,
      timesheetsFailed: failedUpdates,
    });
  } catch (err) {
    console.error("[invoices/send]", err);
    return error(
      err instanceof Error ? err.message : "Failed to send invoice",
      500,
    );
  }
}

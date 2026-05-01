/**
 * POST /api/invoices/reimbursement — generate a personal reimbursement invoice.
 *
 * Any authenticated user can generate a printable invoice of their approved
 * reimbursement entries for a given date range. This is for collective members
 * who submit expenses outside of Gusto (e.g., print and deliver manually).
 */

import { NextRequest } from "next/server";
import { json, error, withNotionError } from "@/lib/api-helpers";
import { resolveUserContext } from "@/lib/role";
import { queryTimesheets } from "@/lib/notion/timesheets";
import { getActiveMembers } from "@/lib/notion/members";
import {
  buildReimbursementInvoiceHtml,
  type ReimbursementInvoiceData,
} from "@/lib/invoice/reimbursement-invoice";

export async function POST(req: NextRequest) {
  const ctx = await resolveUserContext();
  if (!ctx) return error("Unauthorized", 401);

  const body = await req.json();
  const { startDate, endDate } = body;

  if (!startDate || !endDate) {
    return error("startDate and endDate are required", 400);
  }

  return withNotionError(async () => {
    // Fetch approved reimbursement entries for this user
    const { data: timesheets } = await queryTimesheets(
      {
        status: "approved",
        type: "reimbursement",
        dateAfter: startDate,
        dateBefore: endDate,
        ...(ctx.notionUserId ? { personId: ctx.notionUserId } : {}),
      },
      { pageSize: 200 },
    );

    if (timesheets.length === 0) {
      return json({
        lineItems: [],
        total: 0,
        html: "",
        warnings: ["no approved reimbursement entries found for this period"],
      });
    }

    const members = await getActiveMembers();
    const memberMap = new Map(members.map((m) => [m.id, m]));

    const lineItems = timesheets.map((ts) => {
      const memberName = ts.personIds
        .map((pid) => memberMap.get(pid)?.name ?? "unknown")
        .join(", ") || ctx.name;

      const date = ts.dateAndTime?.start
        ? new Date(ts.dateAndTime.start).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "\u2014";

      return {
        date,
        description: ts.entry || "reimbursement",
        member: memberName,
        amount: ts.amount ?? 0,
      };
    });

    const total = lineItems.reduce((sum, li) => sum + li.amount, 0);

    const now = new Date();
    const invoiceDate = now.toISOString().slice(0, 10);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const seq = String(now.getDate()).padStart(2, "0");

    const invoiceData: ReimbursementInvoiceData = {
      invoiceNumber: `WV-R-${now.getFullYear()}-${month}${seq}`,
      invoiceDate,
      periodStart: startDate,
      periodEnd: endDate,
      submitter: {
        name: ctx.name || ctx.email,
        email: ctx.email,
      },
      lineItems,
      total,
      timesheetIds: timesheets.map((ts) => ts.id),
    };

    const html = buildReimbursementInvoiceHtml(invoiceData);

    return json({ ...invoiceData, html });
  });
}

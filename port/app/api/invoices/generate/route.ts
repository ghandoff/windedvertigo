/**
 * POST /api/invoices/generate — preview invoice data for a project + period.
 *
 * Two modes:
 *   - Per-project: { projectId, startDate, endDate } → approved+billable timesheets for that project
 *   - Monthly:     { startDate, endDate }            → all timesheets, grouped by project
 *
 * Returns structured invoice data + HTML for preview. Sending is handled by /api/invoices/send.
 */

import { NextRequest } from "next/server";
import { json, error, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import {
  resolveInvoiceData,
  buildInvoiceHtml,
  resolveMonthlyInvoiceData,
  buildMonthlyInvoiceHtml,
} from "@/lib/invoice/generate-invoice-data";
import { getNotionUserMap } from "@/lib/role";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const body = await req.json();
  const { projectId, startDate, endDate } = body;

  if (!startDate || !endDate) {
    return error("startDate and endDate are required", 400);
  }

  // Monthly mode: no projectId — return all timesheets grouped by project
  if (!projectId) {
    console.log(`[invoices/generate] monthly mode user=${session.user.email} range=${startDate}→${endDate}`);
    return withNotionError(async () => {
      const notionUserMap = await getNotionUserMap();
      const personId = notionUserMap.get(session.user!.email!.toLowerCase()) ?? null;

      const invoiceData = await resolveMonthlyInvoiceData(startDate, endDate, personId);
      console.log(`[invoices/generate] monthly resolved sections=${invoiceData.sections.length} totalHours=${invoiceData.totalHours} timesheets=${invoiceData.timesheetIds.length}`);
      const html = buildMonthlyInvoiceHtml(invoiceData);
      return { ...invoiceData, html, mode: "monthly" };
    });
  }

  // Per-project mode: approved+billable timesheets for a specific project
  console.log(`[invoices/generate] project mode user=${session.user.email} project=${projectId} range=${startDate}→${endDate}`);
  return withNotionError(async () => {
    const invoiceData = await resolveInvoiceData(projectId, startDate, endDate);
    console.log(`[invoices/generate] project resolved lineItems=${invoiceData.lineItems.length} total=${invoiceData.total}`);
    const html = buildInvoiceHtml(invoiceData);
    return { ...invoiceData, html, mode: "project" };
  });
}

/**
 * POST /api/invoices/generate — preview invoice data for a project + period.
 *
 * Returns structured invoice data (line items, totals, client info) without
 * sending or marking timesheets. Used by the invoice generator UI for preview.
 */

import { NextRequest } from "next/server";
import { json, error, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { resolveInvoiceData, buildInvoiceHtml } from "@/lib/invoice/generate-invoice-data";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return error("Unauthorized", 401);

  const body = await req.json();
  const { projectId, startDate, endDate } = body;

  if (!projectId || !startDate || !endDate) {
    return error("projectId, startDate, and endDate are required", 400);
  }

  return withNotionError(async () => {
    const invoiceData = await resolveInvoiceData(projectId, startDate, endDate);
    const html = buildInvoiceHtml(invoiceData);
    return { ...invoiceData, html };
  });
}

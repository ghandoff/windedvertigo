/**
 * Fin financial email scan cron — daily 7am UTC via CRON_TABLE.
 * Scans garrett@windedvertigo.com for bills, invoices, tax notices,
 * and payroll alerts using Claude Haiku for classification.
 * Results land in fin_items (deduped by raw_email_id).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { scanFinancialEmails } from "@/lib/fin/email-scan";

export const maxDuration = 300;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const result = await scanFinancialEmails();
    console.log(
      `[cron/fin-email-scan] seen=${result.seen} captured=${result.already_captured} created=${result.created} skipped=${result.skipped} drive_uploads=${result.drive_uploads} notifications=${result.notifications_sent} errors=${result.errors.length}`,
    );
    return json(result);
  } catch (err) {
    console.error("[cron/fin-email-scan] failed:", err);
    return error("fin email scan failed", 500);
  }
}

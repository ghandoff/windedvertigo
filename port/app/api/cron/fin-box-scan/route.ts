/**
 * Fin Box invoice scan cron — daily 8am UTC via CRON_TABLE.
 * Polls the BOCS contractor Box folder for new invoice PDFs from Maria / Lamis.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { scanBoxInvoices } from "@/lib/fin/box-scan";

export const maxDuration = 120;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const result = await scanBoxInvoices();
    if (result.token_missing) {
      console.warn("[cron/fin-box-scan] BOX_DEV_TOKEN missing — set it via: wrangler secret put BOX_DEV_TOKEN");
    }
    console.log(
      `[cron/fin-box-scan] folders=${result.folders_scanned.join(",")} seen=${result.seen} captured=${result.already_captured} created=${result.created} skipped=${result.skipped} errors=${result.errors.length}`,
    );
    return json(result);
  } catch (err) {
    console.error("[cron/fin-box-scan] failed:", err);
    return error("box invoice scan failed", 500);
  }
}

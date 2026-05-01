/**
 * GET /api/admin/migrate-rfp-urls
 *
 * One-time migration: finds all RFP opportunities whose URL field contains a
 * gmail:message:{id} pseudo-URL (written before dedup/URL were separated),
 * fetches the original email from Gmail, extracts the real procurement URL,
 * and patches the Notion record.
 *
 * Optional query param for targeted retry:
 *   ?retry=opportunityId:messageId,opportunityId2:messageId2
 *   Used when the first run cleared pseudo-URLs but couldn't extract real URLs
 *   (e.g. Google Alerts redirect links). After fixing extractProcurementUrl,
 *   pass the original mapping directly to retry without re-scanning Notion.
 *
 * Idempotent — only touches records that still have gmail:message: URLs
 * (or records explicitly listed in ?retry).
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getRfpGmailAccessToken,
  getRfpGmailUser,
  getMessageWithBody,
  extractProcurementUrl,
} from "@/lib/gmail";
import { queryRfpOpportunities, updateRfpOpportunity } from "@/lib/notion/rfp-radar";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === process.env.CRON_SECRET;
}

interface MigrationRecord {
  id: string;
  opportunityName?: string;
  messageId: string;
  result: "updated" | "no_url_found" | "email_not_found" | "error";
  url?: string;
  error?: string;
}

async function processRecord(
  opportunityId: string,
  messageId: string,
  accessToken: string,
  opportunityName?: string,
): Promise<MigrationRecord> {
  const record: MigrationRecord = {
    id: opportunityId,
    opportunityName,
    messageId,
    result: "no_url_found",
  };

  try {
    const email = await getMessageWithBody(messageId, accessToken, getRfpGmailUser());
    if (!email) {
      record.result = "email_not_found";
      return record;
    }

    const realUrl = extractProcurementUrl(email.body);
    if (!realUrl) {
      await updateRfpOpportunity(opportunityId, { url: "" });
      return record;
    }

    await updateRfpOpportunity(opportunityId, { url: realUrl });
    record.result = "updated";
    record.url = realUrl;
    return record;
  } catch (err) {
    record.result = "error";
    record.error = err instanceof Error ? err.message : String(err);
    return record;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accessToken = await getRfpGmailAccessToken();
  const results: MigrationRecord[] = [];

  // ── Targeted retry mode ───────────────────────────────
  // Pass ?retry=oppId:msgId,oppId2:msgId2 to re-run specific records
  // without needing to re-scan all Notion opportunities.
  const retryParam = req.nextUrl.searchParams.get("retry");
  if (retryParam) {
    const pairs = retryParam.split(",").map((p) => p.trim());
    for (const pair of pairs) {
      const [opportunityId, messageId] = pair.split(":");
      if (!opportunityId || !messageId) continue;
      results.push(await processRecord(opportunityId, messageId, accessToken));
    }
    const migrated = results.filter((r) => r.result === "updated").length;
    return NextResponse.json({ mode: "retry", migrated, results });
  }

  // ── Full scan mode ────────────────────────────────────
  const allOpps = [];
  let cursor: string | undefined;
  do {
    const page = await queryRfpOpportunities(undefined, { pageSize: 100, cursor });
    allOpps.push(...page.data);
    cursor = page.nextCursor ?? undefined;
    if (!page.hasMore) break;
  } while (cursor);

  const legacyOpps = allOpps.filter((o) => o.url?.startsWith("gmail:message:"));
  const scanned = allOpps.length;

  if (legacyOpps.length === 0) {
    return NextResponse.json({ scanned, migrated: 0, message: "nothing to migrate", results });
  }

  for (const opp of legacyOpps) {
    const messageId = opp.url!.replace("gmail:message:", "");
    results.push(await processRecord(opp.id, messageId, accessToken, opp.opportunityName));
  }

  const migrated = results.filter((r) => r.result === "updated").length;
  const notFound = results.filter((r) => r.result === "no_url_found").length;
  const emailMissing = results.filter((r) => r.result === "email_not_found").length;
  const errors = results.filter((r) => r.result === "error").length;

  return NextResponse.json({ scanned, migrated, notFound, emailMissing, errors, results });
}

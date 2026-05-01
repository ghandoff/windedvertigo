/**
 * GET /api/cron/rfp-gmail-scanner              — Vercel cron (daily 8:00 AM UTC)
 * GET /api/cron/rfp-gmail-scanner?backfill=true — One-time full-history backfill
 *
 * Normal mode: scans unread emails in opportunities@ inbox, triages each,
 *   creates RfpOpportunity records, marks emails as read.
 *
 * Backfill mode: scans ALL historical emails (paginated, no unread filter),
 *   uses gmail:message:{id} as dedupKey so re-runs are safe.
 *   Does not modify read/unread state.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Required env vars:
 *   GOOGLE_SA_RFP_SCANNER — service account key JSON (domain-wide delegation)
 *   CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getRfpGmailAccessToken,
  fetchUnreadRfpEmails,
  fetchAllRfpEmails,
  markMessageRead,
  getRfpGmailUser,
  extractProcurementUrl,
} from "@/lib/gmail";
import { ingestOpportunity } from "@/lib/ai/rfp-ingest";
import { notifyNewRfps, type NewRfpItem } from "@/lib/rfp/notify";

// Backfill may process 100+ emails; budget ~5s per AI triage call.
export const maxDuration = 300;

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const backfill = req.nextUrl.searchParams.get("backfill") === "true";

  const result = {
    scanned: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
    backfill,
  };

  try {
    const accessToken = await getRfpGmailAccessToken();

    const emails = backfill
      ? await fetchAllRfpEmails(accessToken)
      : await fetchUnreadRfpEmails(accessToken, 25);

    if (emails.length === 0) {
      return NextResponse.json({ message: "no emails found", ...result });
    }

    const createdForNotification: NewRfpItem[] = [];

    for (const email of emails) {
      result.scanned++;
      try {
        // gmail:message:{id} is the stable dedup key — used only to prevent
        // re-processing the same email, never stored as the opportunity URL.
        const dedupKey = `gmail:message:${email.id}`;

        // Best-effort extraction of the actual procurement source URL from the
        // email body. Stored as the canonical URL so users can navigate to the
        // source and URL-based enrichment can fill missing fields.
        const procurementUrl = extractProcurementUrl(email.body) ?? undefined;

        const outcome = await ingestOpportunity({
          title: email.subject,
          body: email.body,
          url: procurementUrl,
          dedupKey,
          source: "Email Alert",
        });

        if (outcome.created) {
          result.created++;
          createdForNotification.push({
            name: outcome.triage.opportunityName,
            fitScore: outcome.fitScore,
            dueDate: outcome.triage.dueDate,
            url: outcome.url,
            notionPageId: outcome.id,
            torStatus: outcome.torStatus,
            torUrl: outcome.torUrl,
          });
        } else result.skipped++;

        // Normal mode only: mark as read so it won't be re-processed tomorrow.
        // Backfill mode leaves read state unchanged.
        if (!backfill) {
          await markMessageRead(email.id, accessToken, getRfpGmailUser()).catch((err) => {
            console.warn(`[rfp-gmail-scanner] markRead failed for ${email.id}:`, err);
          });
        }
      } catch (err) {
        result.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[rfp-gmail-scanner] email failed:", email.subject, msg);
        result.errors.push(msg);
      }
    }

    // Slack summary — only in normal mode. Backfill can ingest 100+ emails
    // from historical scans; a mention ping for each would be noise.
    if (!backfill) {
      await notifyNewRfps(createdForNotification, "Gmail alerts");
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scanner failed";
    console.error("[rfp-gmail-scanner]", msg);
    return NextResponse.json({ error: msg, ...result }, { status: 500 });
  }
}

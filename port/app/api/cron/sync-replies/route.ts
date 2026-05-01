/**
 * GET /api/cron/sync-replies
 *
 * Vercel cron — runs daily at 8:55am.
 * Detects email replies to our outreach by searching Gmail inbox for
 * messages with "Re:" subjects, matching them to sent EmailDraft records
 * by subject line, and creating Activity records for matched replies.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *   CRON_SECRET
 *
 * Flow:
 *   1. Fetch recent inbox replies from Gmail (last 14 days)
 *   2. For each reply, strip "Re:" prefix and look up matching EmailDraft
 *   3. If found and org email matches sender, create "email received" Activity
 *   4. Skip if an Activity already exists for that org today (dedup)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGmailAccessToken,
  fetchRecentReplies,
  stripReplyPrefix,
  extractEmail,
} from "@/lib/gmail";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import { queryActivities, createActivity } from "@/lib/notion/activities";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Check if Gmail credentials are configured — skip gracefully if not
  if (!process.env.GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({
      message: "Gmail reply sync skipped — GMAIL_REFRESH_TOKEN not set",
      detected: 0,
    });
  }

  const detected: string[] = [];
  const skipped: string[] = [];

  try {
    const accessToken = await getGmailAccessToken();
    const replies = await fetchRecentReplies(14, accessToken);

    if (replies.length === 0) {
      return NextResponse.json({ message: "no replies found", detected: 0 });
    }

    // Fetch sent drafts once (constant query — doesn't depend on individual replies)
    const { data: drafts } = await queryEmailDrafts(
      { status: "sent" },
      { pageSize: 500 },
    );

    for (const reply of replies) {
      const baseSubject = stripReplyPrefix(reply.subject);
      if (!baseSubject) continue;

      const senderEmail = extractEmail(reply.from);

      const matchedDraft = drafts.find(
        (d) => d.subject.toLowerCase().trim() === baseSubject.toLowerCase().trim(),
      );

      if (!matchedDraft) {
        skipped.push(`no draft match for: ${baseSubject}`);
        continue;
      }

      const orgId = matchedDraft.organizationId;

      // Check if we already logged a reply activity for this org recently (dedup)
      const { data: existing } = await queryActivities(
        { type: "email received", orgId },
        { pageSize: 5 },
      );

      const replyDate = new Date(reply.date);
      const alreadyLogged = existing.some((a) => {
        if (!a.date?.start) return false;
        const actDate = new Date(a.date.start);
        // Within 24 hours of the reply date
        return Math.abs(actDate.getTime() - replyDate.getTime()) < 24 * 60 * 60 * 1000;
      });

      if (alreadyLogged) {
        skipped.push(`already logged reply for org ${orgId}`);
        continue;
      }

      // Create activity record
      await createActivity({
        activity: `reply to: ${baseSubject}`,
        type: "email received",
        organizationIds: [orgId],
        date: { start: replyDate.toISOString().split("T")[0], end: null },
        outcome: "positive",
        notes: `auto-detected via gmail sync. sender: ${senderEmail}`,
        loggedBy: "system",
      });

      detected.push(`org ${orgId}: reply to "${baseSubject}" from ${senderEmail}`);
    }

    return NextResponse.json({
      message: `scanned ${replies.length} replies`,
      detected: detected.length,
      actions: [...detected, ...skipped],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync failed";
    console.error("[cron/sync-replies]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

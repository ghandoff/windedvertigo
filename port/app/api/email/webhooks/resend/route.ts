/**
 * POST /api/email/webhooks/resend
 *
 * Receives Resend webhook events (delivered, opened, clicked, bounced).
 * Verifies Svix signature, then updates Email Drafts in Notion.
 *
 * Engagement activities are logged on significant firsts:
 *   - First human open → "email opened" activity on the org
 *   - Every click → "link clicked" activity with the URL
 *   - Bounce/complaint → "email bounced" activity
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import {
  findDraftByResendId,
  incrementOpens,
  incrementMachineOpens,
  incrementClicks,
  updateEmailDraft,
} from "@/lib/notion/email-drafts";
import { createActivity } from "@/lib/notion/activities";

function verifySvixSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting");
      return false;
    }
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping verification (dev only)");
    return true;
  }

  try {
    const wh = new Webhook(secret);
    wh.verify(rawBody, {
      "svix-id": headers.get("svix-id") ?? "",
      "svix-timestamp": headers.get("svix-timestamp") ?? "",
      "svix-signature": headers.get("svix-signature") ?? "",
    });
    return true;
  } catch {
    console.error("[resend-webhook] signature verification failed");
    return false;
  }
}

/** Best-effort activity creation — never blocks or throws. */
async function logEngagementActivity(
  orgId: string,
  title: string,
  type: "email opened" | "link clicked" | "email bounced",
  notes?: string,
) {
  try {
    const today = new Date().toISOString().split("T")[0];
    await createActivity({
      activity: title,
      type,
      organizationIds: [orgId],
      date: { start: today, end: null },
      notes: notes ?? "",
      loggedBy: "resend webhook",
    });
  } catch (err) {
    // Never fail the webhook response over activity logging
    console.error(`[resend-webhook] failed to log activity "${title}":`, err instanceof Error ? err.message : err);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySvixSignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; created_at?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type;
  const data = payload.data;
  if (!eventType || !data) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const emailId = data.email_id as string | undefined;
  const toField = data.to;
  const toAddresses: string[] = Array.isArray(toField)
    ? toField.map(String)
    : typeof toField === "string"
      ? [toField]
      : [];

  console.log(`[resend-webhook] ${eventType}`, { emailId, to: toAddresses });

  if (!emailId) {
    return NextResponse.json({ ok: true, note: "no email_id" });
  }

  // Skip engagement events for internal addresses — pilot sends to ourselves
  // would inflate open/click counts. Any address on the windedvertigo.com domain
  // is treated as internal and excluded from tracking.
  const INTERNAL_DOMAIN = "windedvertigo.com";
  const isInternalRecipient =
    toAddresses.length > 0 &&
    toAddresses.every((addr) => addr.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`));

  if (isInternalRecipient && (eventType === "email.opened" || eventType === "email.clicked")) {
    console.log(`[resend-webhook] skipping ${eventType} for internal recipient(s): ${toAddresses.join(", ")}`);
    return NextResponse.json({ ok: true, note: "internal recipient — tracking skipped" });
  }

  try {
    const draft = await findDraftByResendId(emailId);
    if (!draft) {
      console.log(`[resend-webhook] no draft found for resend ID ${emailId}`);
      return NextResponse.json({ ok: true, note: "draft not found" });
    }

    switch (eventType) {
      case "email.opened": {
        // Bot detection: Apple MPP and security scanners fire the open pixel within
        // seconds of delivery. Humans take at least a minute to open an email.
        // Use the Resend event timestamp vs sentAt to classify the open.
        const eventCreatedAt = payload.created_at;
        const deltaMs = eventCreatedAt && draft.sentAt
          ? new Date(eventCreatedAt).getTime() - new Date(draft.sentAt).getTime()
          : null;
        const isMachineOpen = deltaMs !== null && deltaMs < 60_000;

        if (isMachineOpen) {
          console.log(`[resend-webhook] machine open detected (delta ${deltaMs}ms) — routing to machineOpens`);
          await incrementMachineOpens(draft.id);
        } else {
          // Log activity on first human open (before incrementing, opens === 0 means this is the first)
          if (draft.opens === 0 && draft.organizationId) {
            await logEngagementActivity(
              draft.organizationId,
              `email opened: ${draft.subject}`,
              "email opened",
              `first human open at ${eventCreatedAt ?? "unknown time"}`,
            );
          }
          await incrementOpens(draft.id);
        }
        break;
      }

      case "email.clicked": {
        // Extract clicked URL from Resend's click payload
        const clickData = data.click as { link?: string; userAgent?: string; ipAddress?: string } | undefined;
        const clickedUrl = clickData?.link ?? null;

        await incrementClicks(draft.id);

        // Log every click as an activity — each clicked URL is meaningful engagement signal
        if (draft.organizationId) {
          const urlDisplay = clickedUrl
            ? clickedUrl.replace(/^https?:\/\/(www\.)?/, "").split("?")[0]
            : "unknown link";
          await logEngagementActivity(
            draft.organizationId,
            `link clicked: ${urlDisplay}`,
            "link clicked",
            [
              clickedUrl ? `url: ${clickedUrl}` : null,
              clickData?.userAgent ? `user agent: ${clickData.userAgent}` : null,
              `from email: ${draft.subject}`,
            ].filter(Boolean).join("\n"),
          );
        }
        break;
      }

      case "email.bounced":
      case "email.complained": {
        await updateEmailDraft(draft.id, { status: "failed" });

        // Log bounce/complaint as activity
        if (draft.organizationId) {
          const reason = eventType === "email.bounced" ? "bounced" : "marked as spam";
          await logEngagementActivity(
            draft.organizationId,
            `email ${reason}: ${draft.subject}`,
            "email bounced",
            `recipient: ${toAddresses.join(", ")}`,
          );
        }
        break;
      }

      case "email.delivered":
        // Already marked as "sent" on creation — no action needed
        break;

      default:
        console.log(`[resend-webhook] unhandled event: ${eventType}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "webhook processing failed";
    console.error("[resend-webhook]", msg);
    // Return 200 to prevent Resend from retrying — log the error
  }

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/email/webhooks/resend
 *
 * Receives Resend webhook events (delivered, opened, clicked, bounced).
 * Verifies Svix signature, then updates Email Drafts in Notion.
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { findDraftByResendId, incrementOpens, incrementClicks, updateEmailDraft } from "@/lib/notion/email-drafts";

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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySvixSignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; data?: Record<string, unknown> };
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
  console.log(`[resend-webhook] ${eventType}`, { emailId, to: data.to });

  if (!emailId) {
    return NextResponse.json({ ok: true, note: "no email_id" });
  }

  try {
    const draft = await findDraftByResendId(emailId);
    if (!draft) {
      console.log(`[resend-webhook] no draft found for resend ID ${emailId}`);
      return NextResponse.json({ ok: true, note: "draft not found" });
    }

    switch (eventType) {
      case "email.opened":
        await incrementOpens(draft.id, draft.opens);
        break;
      case "email.clicked":
        await incrementClicks(draft.id, draft.clicks);
        break;
      case "email.bounced":
      case "email.complained":
        await updateEmailDraft(draft.id, { status: "failed" });
        break;
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

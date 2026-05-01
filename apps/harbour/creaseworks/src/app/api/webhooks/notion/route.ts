/**
 * POST /api/webhooks/notion
 *
 * Receives webhook events from Notion when pages are created, updated,
 * or deleted. Performs incremental sync of the affected page rather than
 * a full database refresh.
 *
 * Because Notion allows only one webhook per integration, this handler
 * also acts as a fan-out proxy — forwarding the raw payload to the
 * harbour revalidation endpoint so ISR pages update near-instantly.
 *
 * The daily cron sync remains as a fallback to catch anything missed.
 *
 * Verification:
 *   - On first registration Notion sends { verification_token: "..." }.
 *   - Subsequent events carry an X-Notion-Signature HMAC-SHA256 header.
 *
 * MVP 7 — Notion webhook listener (replaces polling with push).
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createHmac } from "crypto";
import { syncSinglePage, handlePageDeletion } from "@/lib/sync/incremental";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function getNotionClient(): Client {
  if (!process.env.NOTION_TOKEN) {
    throw new Error("NOTION_TOKEN not set");
  }
  return new Client({ auth: process.env.NOTION_TOKEN });
}

/**
 * Verify the Notion webhook signature.
 * Notion signs the request body with HMAC-SHA256 using the verification_token
 * that was sent during the initial url_verification handshake.
 * Store that token as NOTION_WEBHOOK_SECRET in your environment.
 */
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[webhook] NOTION_WEBHOOK_SECRET not set in production — rejecting request");
      return false;
    }
    console.warn("[webhook] NOTION_WEBHOOK_SECRET not set — skipping verification (dev only)");
    return true;
  }
  if (!signature) return false;

  // Notion prefixes with "sha256=" — strip it if present
  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  // Timing-safe comparison
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

/* ------------------------------------------------------------------ */
/*  harbour revalidation fan-out                                       */
/* ------------------------------------------------------------------ */

/** Base URL for the harbour site — shared domain, different basePath. */
const HARBOUR_REVALIDATE_URL =
  "https://windedvertigo.com/harbour/api/revalidate";

/**
 * Forward the raw webhook payload to the harbour revalidation endpoint.
 * Fire-and-forget — we don't await the result or let failures affect
 * this handler's response. The harbour endpoint independently verifies
 * the signature and decides which paths to revalidate.
 */
function forwardToHarbour(rawBody: string, signature: string | null): void {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature) {
    headers["x-notion-signature"] = signature;
  }

  fetch(HARBOUR_REVALIDATE_URL, {
    method: "POST",
    headers,
    body: rawBody,
  }).catch((err) => {
    // Log but don't throw — forwarding failure must never block sync
    console.warn("[webhook] harbour forward failed:", err.message ?? err);
  });
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Handle Notion's verification token BEFORE signature check.
  // Notion sends { verification_token: "secret_..." } (no type field).
  // The token is also used as the HMAC secret for future event signatures.
  // Accept verification tokens to allow webhook re-registration.
  if (payload.verification_token && !payload.type) {
    console.log("[webhook] verification token received");
    return NextResponse.json({ ok: true });
  }

  // Verify signature for all non-verification events
  const signature = request.headers.get("x-notion-signature");
  if (!verifySignature(rawBody, signature)) {
    console.warn("[webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Fan out to harbour revalidation (fire-and-forget).
  // Every event gets forwarded — harbour's DB_PATH_MAP decides
  // which paths to revalidate (or falls back to revalidating all).
  forwardToHarbour(rawBody, signature);

  // Process page events
  const eventType = payload.type;
  const pageId = payload.entity?.id ?? payload.data?.id;
  const databaseId =
    payload.entity?.parent?.database_id ??
    payload.data?.parent?.database_id;

  if (!pageId) {
    console.warn("[webhook] event missing page ID:", eventType);
    return NextResponse.json({ ok: true, skipped: true });
  }

  console.log(`[webhook] received ${eventType} for page ${pageId}`);

  try {
    if (
      eventType === "page.deleted" ||
      eventType === "page.archived" ||
      eventType === "page.trashed"
    ) {
      // Handle deletion
      if (databaseId) {
        const result = await handlePageDeletion(pageId, databaseId);
        return NextResponse.json({ ok: true, ...result });
      }
      return NextResponse.json({ ok: true, skipped: true, reason: "no database ID" });
    }

    if (
      eventType === "page.created" ||
      eventType === "page.updated" ||
      eventType === "page.content_updated" ||
      eventType === "page.properties_updated"
    ) {
      if (!databaseId) {
        // Try to fetch the page to find its parent database
        const client = getNotionClient();
        const page = await client.pages.retrieve({ page_id: pageId }) as any;
        const parentDbId = page.parent?.database_id;
        if (parentDbId) {
          const result = await syncSinglePage(client, pageId, parentDbId);
          return NextResponse.json({ ok: true, ...result });
        }
        return NextResponse.json({ ok: true, skipped: true, reason: "not a database page" });
      }

      const client = getNotionClient();
      const result = await syncSinglePage(client, pageId, databaseId);
      return NextResponse.json({ ok: true, ...result });
    }

    // Unknown event type — acknowledge it
    console.log(`[webhook] unhandled event type: ${eventType}`);
    return NextResponse.json({ ok: true, skipped: true, reason: `unhandled: ${eventType}` });
  } catch (err: any) {
    console.error(`[webhook] sync failed for ${pageId}:`, err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "sync failed" },
      { status: 500 },
    );
  }
}

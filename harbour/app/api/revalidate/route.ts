/**
 * POST /api/revalidate
 *
 * Receives webhook events from Notion when pages are created, updated,
 * or deleted. Triggers on-demand ISR revalidation for the affected pages
 * so content updates appear within seconds instead of waiting for the
 * hourly revalidation cycle.
 *
 * Verification:
 *   - On first registration Notion sends { verification_token: "..." }.
 *   - Subsequent events carry an X-Notion-Signature HMAC-SHA256 header.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHmac } from "crypto";

/* ------------------------------------------------------------------ */
/*  database ID → path mapping                                         */
/* ------------------------------------------------------------------ */

const DB_PATH_MAP: Record<string, string[]> = {
  // harbour games list
  "8e3f3364b2654640a91ed0f38b091a07": ["/harbour"],
  "8e3f3364-b265-4640-a91e-d0f38b091a07": ["/harbour"],
  // site content (hero, CTA, credibility sections)
  "09a046a556c1455e80073546b8f83297": ["/harbour"],
  "09a046a5-56c1-455e-8007-3546b8f83297": ["/harbour"],
  // depth.chart skills
  "38873e53f36f4b2885552fdf6cdc98cb": ["/harbour/skills"],
  "38873e53-f36f-4b28-8555-2fdf6cdc98cb": ["/harbour/skills"],
};

/* ------------------------------------------------------------------ */
/*  signature verification                                             */
/* ------------------------------------------------------------------ */

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[revalidate] NOTION_WEBHOOK_SECRET not set — rejecting");
      return false;
    }
    console.warn("[revalidate] NOTION_WEBHOOK_SECRET not set — skipping verification (dev only)");
    return true;
  }
  if (!signature) return false;

  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = createHmac("sha256", secret).update(body).digest("hex");

  // timing-safe comparison
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Handle Notion's verification handshake (no signature on this one).
  // Accept verification tokens to allow webhook re-registration.
  if (payload.verification_token && !payload.type) {
    console.log("[revalidate] verification token received (re-registration ok)");
    return NextResponse.json({ ok: true });
  }

  // Verify signature
  const signature = request.headers.get("x-notion-signature");
  if (!verifySignature(rawBody, signature)) {
    console.warn("[revalidate] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Extract database ID from the event payload
  const entity = payload.entity as Record<string, Record<string, string>> | undefined;
  const data = payload.data as Record<string, Record<string, string>> | undefined;
  const databaseId: string | undefined =
    entity?.parent?.database_id ??
    data?.parent?.database_id ??
    undefined;

  const eventType = String(payload.type ?? "unknown");
  const pageId = String(entity?.id ?? data?.id ?? "unknown");

  console.log(`[revalidate] ${eventType} for page ${pageId} (db: ${databaseId})`);

  // Find paths to revalidate
  const paths = databaseId ? DB_PATH_MAP[databaseId] : undefined;

  if (!paths) {
    // Unknown database — revalidate everything as a safe fallback
    console.log("[revalidate] unknown database, revalidating all paths");
    revalidatePath("/harbour");
    revalidatePath("/harbour/skills");
    return NextResponse.json({ ok: true, revalidated: ["/harbour", "/harbour/skills"] });
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  console.log(`[revalidate] revalidated: ${paths.join(", ")}`);
  return NextResponse.json({ ok: true, revalidated: paths });
}

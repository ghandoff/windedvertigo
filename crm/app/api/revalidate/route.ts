/**
 * POST /api/revalidate
 *
 * Receives Notion webhook events for CRM databases.
 * Triggers on-demand ISR revalidation.
 * Pattern: harbour/app/api/revalidate/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHmac } from "crypto";
import { CRM_DB } from "@/lib/notion/client";

const DB_PATH_MAP: Record<string, string[]> = {
  [CRM_DB.organizations]: ["/"],
  [CRM_DB.contacts]: ["/"],
  [CRM_DB.projects]: ["/"],
  [CRM_DB.bdAssets]: ["/"],
  [CRM_DB.competitive]: ["/"],
  [CRM_DB.events]: ["/"],
  [CRM_DB.socialQueue]: ["/"],
  [CRM_DB.emailDrafts]: ["/"],
};

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

  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (payload.verification_token && !payload.type) {
    console.log("[revalidate] verification token received");
    return NextResponse.json({ ok: true });
  }

  const signature = request.headers.get("x-notion-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const entity = payload.entity as Record<string, Record<string, string>> | undefined;
  const data = payload.data as Record<string, Record<string, string>> | undefined;
  const databaseId =
    entity?.parent?.database_id ?? data?.parent?.database_id ?? undefined;

  const eventType = String(payload.type ?? "unknown");
  console.log(`[revalidate] ${eventType} (db: ${databaseId})`);

  const paths = databaseId ? DB_PATH_MAP[databaseId] : undefined;

  if (!paths) {
    revalidatePath("/");
    return NextResponse.json({ ok: true, revalidated: ["/"] });
  }

  for (const p of paths) {
    revalidatePath(p);
  }

  return NextResponse.json({ ok: true, revalidated: paths });
}

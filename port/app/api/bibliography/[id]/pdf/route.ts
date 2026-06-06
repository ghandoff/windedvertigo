/**
 * Serve a stored bibliography PDF from R2 (`bibliography-pdfs/<id>.pdf`).
 * Session-gated by middleware (this path is NOT in the agent-token exemption —
 * only /api/bibliography/import is). Streams the object via the PORT_ASSETS
 * binding; falls back to the S3 client in local dev.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2/client";
import "@/lib/cf-env";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("bad id", { status: 400 });
  const key = `bibliography-pdfs/${id}.pdf`;

  // Native R2 binding (production)
  try {
    const { env } = getCloudflareContext();
    const bucket = (env as unknown as { PORT_ASSETS?: { get(k: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null> } }).PORT_ASSETS;
    if (bucket?.get) {
      const obj = await bucket.get(key);
      if (!obj) return new Response("not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType ?? "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  } catch {
    // not in CF Workers context — fall through to S3
  }

  // S3 fallback (local dev)
  try {
    const out = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    if (!out.Body) return new Response("not found", { status: 404 });
    return new Response(out.Body as unknown as ReadableStream, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

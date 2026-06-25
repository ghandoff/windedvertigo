/**
 * POST /api/listen — submit a document to be read aloud (Carl's voice).
 * GET  /api/listen — list the caller's listen items for the player.
 *
 * Session-gated (not in the middleware allowlist) — this is a private collective
 * feature. The POST extracts text here (Node runtime: pdf-parse/mammoth, plus
 * Google Docs / URL resolvers), stores it in R2, then enqueues a DocumentAudioJob
 * that the port-jobs consumer renders to audio. Extraction lives here, not in the
 * consumer, because the CF-Worker consumer can't run pdf-parse / the Google libs.
 *
 * Node runtime required for pdf-parse + mammoth (same as /api/extract-text).
 */

import { NextRequest } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { auth } from "@/lib/auth";
import { error } from "@/lib/api-helpers";
import { uploadAsset } from "@/lib/r2/upload";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import {
  resolveGoogleDoc,
  resolveUrl,
  resolveUpload,
  contentHash,
  type ResolvedSource,
} from "@/lib/listen/extract";
import {
  createListenItem,
  getListenItems,
  updateListenItem,
  findReadyByHash,
  type ListenCleanLevel,
} from "@/lib/supabase/listen";
import { DEFAULT_LISTEN_PROVIDER } from "@/lib/tts";
import "@/lib/cf-env";

const LISTEN_PROVIDER = process.env.LISTEN_TTS_PROVIDER ?? DEFAULT_LISTEN_PROVIDER;

export const runtime = "nodejs";
export const maxDuration = 60;

async function extractUpload(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const buf = await file.arrayBuffer();
  if (ext === "pdf") return (await pdfParse(Buffer.from(buf))).text ?? "";
  if (ext === "docx") return (await mammoth.extractRawText({ buffer: Buffer.from(buf) })).value;
  if (ext === "txt") return new TextDecoder().decode(buf);
  throw new Error(`unsupported file type: .${ext} (use pdf, docx, or txt)`);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);
  // Per-user: the booth only ever shows the caller's own items. Same login sees
  // the same items across devices (rows are server-stored, keyed by created_by);
  // different logins are isolated — you don't see Maria's, she doesn't see yours.
  const items = await getListenItems({ createdBy: session.user.email, limit: 100 });
  return Response.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);
  const who = session.user.email;

  const contentType = req.headers.get("content-type") ?? "";
  let resolved: ResolvedSource;
  let cleanLevel: ListenCleanLevel = "clean";
  let condense = false;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return error("a file is required", 400);
      if (form.get("cleanLevel") === "faithful") cleanLevel = "faithful";
      condense = form.get("condense") === "true";
      resolved = resolveUpload(await extractUpload(file), file.name);
    } else {
      const body = (await req.json()) as {
        sourceType?: string;
        url?: string;
        subject?: string;
        cleanLevel?: string;
        title?: string;
        condense?: boolean;
      };
      if (body.cleanLevel === "faithful") cleanLevel = "faithful";
      condense = body.condense === true;
      if (body.sourceType === "google-doc" && body.url) {
        resolved = await resolveGoogleDoc(body.url, { subject: body.subject ?? who, title: body.title });
      } else if (body.sourceType === "url" && body.url) {
        resolved = await resolveUrl(body.url);
      } else {
        return error("provide a file upload, or { sourceType: 'google-doc' | 'url', url }", 400);
      }
    }
  } catch (e) {
    return error(e instanceof Error ? e.message : "could not read that source", 400);
  }

  if (!resolved.text.trim()) return error("no readable text found in that source", 400);

  // dedupe cache: identical content + settings + engine → reuse the existing
  // render instead of paying to synthesize it again.
  const hash = await contentHash(resolved.text, { cleanLevel, condense, provider: LISTEN_PROVIDER });
  const existing = await findReadyByHash(who, hash);
  if (existing) return Response.json({ ok: true, deduped: true, item: existing });

  // 1. create the item, 2. stash extracted text in R2, 3. enqueue the render job
  const item = await createListenItem({
    title: resolved.title,
    source_type: resolved.sourceType,
    source_ref: resolved.sourceRef,
    created_by: who,
    clean_level: cleanLevel,
    voice: LISTEN_PROVIDER,
    char_count: resolved.text.length,
    condense,
    content_hash: hash,
  });

  const textKey = `listen-text/${item.id}.txt`;
  await uploadAsset(Buffer.from(resolved.text, "utf8"), textKey, "text/plain; charset=utf-8");
  await updateListenItem(item.id, { text_key: textKey });

  // Await the enqueue — a fire-and-forget send() can be dropped when the worker
  // returns its response before the queue write flushes (no ctx.waitUntil).
  try {
    const { env } = getCloudflareContext();
    await publishJob(env.LISTEN_QUEUE, {
      type: "listen/render-document",
      itemId: item.id,
      textKey,
      cleanLevel,
      enqueuedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[listen] enqueue failed:", e);
    await updateListenItem(item.id, { status: "failed", error: "could not queue the render job" });
    return error("could not queue the render job", 502);
  }

  return Response.json({ ok: true, item: { ...item, text_key: textKey, status: "queued" } });
}

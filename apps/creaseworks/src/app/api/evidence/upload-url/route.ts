/**
 * API route: /api/evidence/upload-url
 *
 * POST — generate a presigned R2 PUT URL for direct browser upload.
 *
 * Request body:
 *   { runId, evidenceId, contentType, fileName }
 *
 * Returns:
 *   { uploadUrl, storageKey, thumbnailKey }
 *
 * The client uploads directly to R2 via the presigned URL, then
 * PATCHes the evidence item with the storageKey + thumbnailKey.
 *
 * Phase A — evidence capture (practitioner tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
  buildStorageKey,
  buildThumbnailKey,
  generateUploadUrl,
} from "@/lib/r2";
import { isValidUuid } from "@/lib/validation";

/** Map MIME type to file extension. */
function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/heic": return "heic";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }

  const { runId, evidenceId, contentType } = body;

  // Validate IDs
  if (!runId || !isValidUuid(runId)) {
    return NextResponse.json({ error: "valid runId is required" }, { status: 400 });
  }
  if (!evidenceId || !isValidUuid(evidenceId)) {
    return NextResponse.json({ error: "valid evidenceId is required" }, { status: 400 });
  }

  // Validate content type
  if (!contentType || !ACCEPTED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `content type must be one of: ${[...ACCEPTED_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Org ID is needed for the storage path
  const orgId = session.orgId ?? "personal";
  const ext = extFromMime(contentType);
  const storageKey = buildStorageKey(orgId, runId, evidenceId, ext);
  const thumbnailKey = buildThumbnailKey(storageKey);

  try {
    const uploadUrl = await generateUploadUrl(storageKey, contentType);

    return NextResponse.json({
      uploadUrl,
      storageKey,
      thumbnailKey,
      maxFileSize: MAX_FILE_SIZE,
    });
  } catch (err: any) {
    console.error("generate upload URL error:", err);

    // Graceful fallback if R2 isn't configured yet
    if (err.message?.includes("R2 credentials not configured")) {
      return NextResponse.json(
        { error: "photo uploads are not yet configured — check R2 environment variables" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "failed to generate upload URL" },
      { status: 500 },
    );
  }
}

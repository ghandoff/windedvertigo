/**
 * POST /api/compose/drafts/[id]/attach — upload an image to R2 and append
 * its public URL to the draft's attached_image_urls array.
 *
 * Multipart form:
 *   image  (Blob) — the image file. Server-side mime + size are validated.
 *
 * Returns the updated draft so the editor can refresh state in one round-trip.
 *
 * Mirrors the upload pattern used in app/api/transcribe/route.ts (R2 via
 * lib/r2/upload.ts::uploadAsset). Image deletion goes through the existing
 * PATCH /api/compose/drafts/[id] with a filtered attachedImageUrls array —
 * no separate delete endpoint needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getComposeDraft, updateComposeDraft } from "@/lib/supabase/compose-drafts";
import { uploadAsset } from "@/lib/r2/upload";

export const maxDuration = 60;

// 10 MB cap — covers any reasonable social-media image while keeping the
// CF Worker memory footprint sane (we hold the file in a Buffer before
// uploading).
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const draft = await getComposeDraft(id);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid multipart body" }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "image_too_large", message: `Max ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }
  const contentType = image.type || "image/jpeg";
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: "unsupported_image_type", message: `Got ${contentType}. Allowed: ${[...ALLOWED_MIME].join(", ")}.` },
      { status: 415 },
    );
  }

  // Upload to R2. Key shape mirrors transcribe/route.ts:107 — per-draft
  // prefix keeps the bucket browsable + scoped, timestamped to avoid
  // collisions on rapid retries.
  const buffer = Buffer.from(await image.arrayBuffer());
  const ext = extensionFor(contentType);
  const key = `compose/${draft.id}/${Date.now()}.${ext}`;
  let publicUrl: string;
  try {
    publicUrl = await uploadAsset(buffer, key, contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "r2 upload failed";
    console.warn("[compose/attach] R2 upload failed:", message);
    return NextResponse.json({ error: "upload_failed", message }, { status: 500 });
  }

  // Append URL to the draft's existing list. Read-then-write avoids racing
  // with concurrent uploads on the same draft (unlikely but defensive).
  const updatedUrls = [...draft.attachedImageUrls, publicUrl];
  const updated = await updateComposeDraft(draft.id, {
    attachedImageUrls: updatedUrls,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "draft_update_failed", message: "Image uploaded to R2 but draft row didn't update." },
      { status: 500 },
    );
  }

  return NextResponse.json({ draft: updated, uploadedUrl: publicUrl });
}

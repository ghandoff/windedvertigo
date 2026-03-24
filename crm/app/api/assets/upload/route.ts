/**
 * POST /api/assets/upload
 *
 * Upload campaign assets to Cloudflare R2.
 * Accepts multipart form data with a "file" field.
 */

import { NextRequest } from "next/server";
import { uploadAsset, generateAssetKey } from "@/lib/r2/upload";
import { json, error } from "@/lib/api-helpers";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return error("Expected multipart form data");

  const file = formData.get("file") as File | null;
  if (!file) return error("No file provided");

  if (!ALLOWED_TYPES.has(file.type)) {
    return error(`File type ${file.type} not allowed. Accepted: png, jpg, gif, webp, svg, pdf`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = generateAssetKey(file.name);

  try {
    const url = await uploadAsset(buffer, key, file.type);
    return json({ url, key, size: buffer.length, contentType: file.type }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[assets/upload]", msg);
    return error(msg, 500);
  }
}

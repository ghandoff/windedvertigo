/**
 * Image sync utility — downloads from source URL and uploads to R2.
 *
 * Called inline during ISR revalidation so portfolio thumbnails get
 * permanent R2 URLs instead of expiring Notion signed URLs.
 *
 * Never throws — failed images fall back to the original URL.
 */

import { uploadBuffer, getPublicUrl } from "@/lib/r2";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function inferExtension(contentType: string | null, sourceUrl: string): string {
  if (contentType) {
    const base = contentType.split(";")[0].trim().toLowerCase();
    if (EXT_MAP[base]) return EXT_MAP[base];
  }

  try {
    const pathname = new URL(sourceUrl).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot !== -1) {
      const ext = pathname.slice(dot + 1).toLowerCase().split("?")[0];
      if (ext && ext.length <= 5) return ext;
    }
  } catch {
    // invalid URL — ignore
  }

  return "jpg";
}

/**
 * Download an image and upload it to R2 with a deterministic key.
 *
 * Storage key: `portfolio-images/{notionPageId}/{slot}.{ext}`
 *
 * Returns the R2 key on success, null on failure.
 */
export async function syncImageToR2(
  sourceUrl: string,
  notionPageId: string,
  slot: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(
        `[sync-image] failed to download ${slot} for ${notionPageId}: HTTP ${res.status}`,
      );
      return null;
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      console.warn(
        `[sync-image] ${slot} for ${notionPageId} too large (${contentLength} bytes), skipping`,
      );
      return null;
    }

    const buffer = await res.arrayBuffer();

    if (buffer.byteLength > MAX_IMAGE_BYTES || buffer.byteLength === 0) {
      console.warn(
        `[sync-image] ${slot} for ${notionPageId} size issue (${buffer.byteLength} bytes), skipping`,
      );
      return null;
    }

    const contentType = res.headers.get("content-type");
    const ext = inferExtension(contentType, sourceUrl);
    const mimeType = contentType?.split(";")[0].trim() ?? `image/${ext}`;

    const key = `portfolio-images/${notionPageId}/${slot}.${ext}`;
    await uploadBuffer(key, new Uint8Array(buffer), mimeType);

    return key;
  } catch (err) {
    console.warn(
      `[sync-image] error syncing ${slot} for ${notionPageId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Given an R2 key, return the public URL. Null-safe. */
export function imageUrl(r2Key: string | null | undefined): string | null {
  if (!r2Key) return null;
  return getPublicUrl(r2Key);
}

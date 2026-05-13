/**
 * Image sync utility — downloads from source URL and uploads to R2.
 *
 * Called inline during ISR revalidation so portfolio thumbnails get
 * permanent R2 URLs instead of expiring Notion signed URLs.
 *
 * Never throws — failed images fall back to the original URL.
 */

import { uploadBuffer, objectExists, getPublicUrl } from "@/lib/r2";

// ── Module-level URL→R2-key cache ────────────────────────────────────────────
// Persists for the lifetime of the CF Workers instance (typically minutes–hours
// of warm traffic). On a cold start the first request pays the full download +
// upload cost; all subsequent requests within the same instance skip it
// entirely. Combined with the R2 existence check below, even cold-start
// requests for already-synced images skip the download.
//
// Map<sourceUrl, r2Key | null>
//   r2Key  = already synced — return this key directly
//   null   = sync failed previously — don't retry this request, let next request try again
//   absent = not yet attempted this instance
const _r2KeyCache = new Map<string, string | null>();

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
 * Storage key: `portfolio-images/{notionPageId}/{slot}` (no extension — content-type
 * stored in R2 metadata so browsers receive the correct header regardless).
 * Extensionless keys let us HEAD-check existence without knowing the mime type
 * in advance, avoiding a full re-download on every request.
 *
 * Returns the R2 key on success, null on failure.
 */
export async function syncImageToR2(
  sourceUrl: string,
  notionPageId: string,
  slot: string,
): Promise<string | null> {
  // 1. Module-level in-memory cache (hot path — same worker instance)
  const cached = _r2KeyCache.get(sourceUrl);
  if (cached !== undefined) return cached;

  const key = `portfolio-images/${notionPageId}/${slot}`;

  try {
    // 2. R2 existence check — single HEAD request, no download needed
    //    Covers cold-start requests where the image was synced by a previous instance.
    const alreadySynced = await objectExists(key);
    if (alreadySynced) {
      _r2KeyCache.set(sourceUrl, key);
      return key;
    }

    // 3. First-time sync: download + upload
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(
        `[sync-image] failed to download ${slot} for ${notionPageId}: HTTP ${res.status}`,
      );
      _r2KeyCache.set(sourceUrl, null);
      return null;
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      console.warn(
        `[sync-image] ${slot} for ${notionPageId} too large (${contentLength} bytes), skipping`,
      );
      _r2KeyCache.set(sourceUrl, null);
      return null;
    }

    const buffer = await res.arrayBuffer();

    if (buffer.byteLength > MAX_IMAGE_BYTES || buffer.byteLength === 0) {
      console.warn(
        `[sync-image] ${slot} for ${notionPageId} size issue (${buffer.byteLength} bytes), skipping`,
      );
      _r2KeyCache.set(sourceUrl, null);
      return null;
    }

    const contentType = res.headers.get("content-type");
    const ext = inferExtension(contentType, sourceUrl);
    const mimeType = contentType?.split(";")[0].trim() ?? `image/${ext}`;

    await uploadBuffer(key, new Uint8Array(buffer), mimeType);
    _r2KeyCache.set(sourceUrl, key);
    return key;
  } catch (err) {
    console.warn(
      `[sync-image] error syncing ${slot} for ${notionPageId}:`,
      err instanceof Error ? err.message : err,
    );
    _r2KeyCache.set(sourceUrl, null);
    return null;
  }
}

/** Given an R2 key, return the public URL. Null-safe. */
export function imageUrl(r2Key: string | null | undefined): string | null {
  if (!r2Key) return null;
  return getPublicUrl(r2Key);
}

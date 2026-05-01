/**
 * Notion-image → R2 sync logic.
 *
 * Pulled out of apps/creaseworks/src/lib/sync/sync-image.ts and
 * apps/vertigo-vault/lib/sync/sync-image.ts as part of Cleanup A.
 *
 * Behaviour is intentionally identical to the original per-app modules:
 * - 15s download timeout
 * - 10MB hard cap (header check + post-download check)
 * - empty-body guard
 * - module-level failure counter (`getImageFailureCount` /
 *   `resetImageFailureCount`) so cron routes can detect silent
 *   credential / quota issues
 * - swallowed errors (returns null), so a single bad image never
 *   breaks the surrounding text-property sync
 *
 * Each consumer app instantiates its own syncer via
 * {@link createImageSyncer}, passing in its local `uploadBuffer` and
 * `getPublicUrl` from `lib/r2.ts`. That keeps R2 credential / bucket
 * configuration owned by the app, while the download / size-guard /
 * failure-counter logic lives once in this package.
 */

import type {
  ImageSyncer,
  ImageSyncerOptions,
} from "./types";

/** Max image size we'll download — skip anything larger to avoid function timeouts. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Map content-type → file extension. */
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/heic": "heic",
};

/**
 * Infer a file extension from the content-type header, or fall back
 * to the URL path extension.
 */
function inferExtension(contentType: string | null, sourceUrl: string): string {
  if (contentType) {
    const base = contentType.split(";")[0]!.trim().toLowerCase();
    if (EXT_MAP[base]) return EXT_MAP[base]!;
  }

  // fall back to URL path extension
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

  return "jpg"; // safe default
}

/**
 * Build an image syncer bound to a particular R2 client.
 *
 * Returns the same surface (`syncImageToR2`, `imageUrl`,
 * `getImageFailureCount`, `resetImageFailureCount`) that the original
 * per-app modules exported, so callers can continue importing the
 * same names from their app-local `sync-image.ts`.
 *
 * The failure counter is closed over per-instance, matching the
 * original module-level behaviour of one counter per app process.
 */
export function createImageSyncer(opts: ImageSyncerOptions): ImageSyncer {
  const { uploadBuffer, getPublicUrl } = opts;
  let imageFailures = 0;

  async function syncImageToR2(
    sourceUrl: string,
    notionPageId: string,
    slot: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(15_000), // 15s download timeout
      });

      if (!res.ok) {
        imageFailures++;
        console.warn(
          `[sync-image] failed to download ${slot} for ${notionPageId}: HTTP ${res.status}`,
        );
        return null;
      }

      // size guard — check content-length header first
      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
        imageFailures++;
        console.warn(
          `[sync-image] ${slot} for ${notionPageId} too large (${contentLength} bytes), skipping`,
        );
        return null;
      }

      const buffer = await res.arrayBuffer();

      // double-check actual size
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        imageFailures++;
        console.warn(
          `[sync-image] ${slot} for ${notionPageId} too large (${buffer.byteLength} bytes), skipping`,
        );
        return null;
      }

      if (buffer.byteLength === 0) {
        imageFailures++;
        console.warn(
          `[sync-image] ${slot} for ${notionPageId} is empty, skipping`,
        );
        return null;
      }

      const contentType = res.headers.get("content-type");
      const ext = inferExtension(contentType, sourceUrl);
      const mimeType = contentType?.split(";")[0]!.trim() ?? `image/${ext}`;

      // deterministic key — re-syncs overwrite the same object
      const key = `notion-images/${notionPageId}/${slot}.${ext}`;

      await uploadBuffer(key, new Uint8Array(buffer), mimeType);

      return key;
    } catch (err) {
      imageFailures++;
      console.warn(
        `[sync-image] error syncing ${slot} for ${notionPageId}:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  function imageUrl(r2Key: string | null | undefined): string | null {
    if (!r2Key) return null;
    return getPublicUrl(r2Key);
  }

  function getImageFailureCount(): number {
    return imageFailures;
  }

  function resetImageFailureCount(): void {
    imageFailures = 0;
  }

  return {
    syncImageToR2,
    imageUrl,
    getImageFailureCount,
    resetImageFailureCount,
  };
}

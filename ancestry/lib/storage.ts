/**
 * Storage abstraction — R2 on CF Workers, @vercel/blob on Vercel.
 *
 * This module is the single call-site for all media upload/delete operations.
 * Callers never import from @vercel/blob or @opennextjs/cloudflare directly.
 *
 * Environment routing:
 *   CF_WORKERS_ENV is set  → R2 binding (ANCESTRY_MEDIA) via getCloudflareContext()
 *   CF_WORKERS_ENV absent  → @vercel/blob put/del (Vercel deployment)
 *
 * Key format: ancestry/{treeId}/{personId}/{timestamp}-{filename}
 * Derive key from public URL: url.slice(ANCESTRY_MEDIA_PUBLIC_URL.length + 1)
 */

// ─── R2 ─────────────────────────────────────────────────────────────────────
// ANCESTRY_MEDIA is declared in cloudflare-env.d.ts, which augments the global
// CloudflareEnv interface from @opennextjs/cloudflare.

async function r2Put(key: string, body: ArrayBuffer, contentType: string): Promise<string> {
  // Dynamic import keeps this code path tree-shaken on Vercel builds.
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  await env.ANCESTRY_MEDIA.put(key, body, {
    httpMetadata: { contentType },
  });
  const publicUrl = process.env.ANCESTRY_MEDIA_PUBLIC_URL;
  if (!publicUrl) throw new Error("ANCESTRY_MEDIA_PUBLIC_URL is not set");
  return `${publicUrl}/${key}`;
}

async function r2Delete(url: string): Promise<void> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  const publicUrl = process.env.ANCESTRY_MEDIA_PUBLIC_URL ?? "";
  const key = publicUrl && url.startsWith(publicUrl)
    ? url.slice(publicUrl.length + 1)
    : url;
  await env.ANCESTRY_MEDIA.delete(key);
}

// ─── Vercel Blob ─────────────────────────────────────────────────────────────

async function blobPut(key: string, file: File): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(key, file, { access: "public" });
  return blob.url;
}

async function blobDelete(url: string): Promise<void> {
  const { del } = await import("@vercel/blob");
  await del(url);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload a media file and return its public URL.
 *
 * @param file     The File to upload (must be an image)
 * @param key      Storage key, e.g. "ancestry/{treeId}/{personId}/{ts}-{name}"
 */
export async function uploadMedia(file: File, key: string): Promise<string> {
  if (process.env.CF_WORKERS_ENV) {
    const buf = await file.arrayBuffer();
    return r2Put(key, buf, file.type);
  }
  return blobPut(key, file);
}

/**
 * Delete a media file by its public URL.
 * Silently ignores errors (file may already be deleted).
 */
export async function deleteMediaByUrl(url: string): Promise<void> {
  try {
    if (process.env.CF_WORKERS_ENV) {
      await r2Delete(url);
    } else {
      await blobDelete(url);
    }
  } catch (err) {
    // Non-critical: log but don't rethrow
    console.warn("[storage] deleteMediaByUrl failed silently:", err);
  }
}

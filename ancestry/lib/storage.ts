/**
 * Storage abstraction — R2 only (CF Workers).
 *
 * Single call-site for all ancestry media upload/delete operations.
 * Key format: ancestry/{treeId}/{personId}/{timestamp}-{filename}
 * Derive key from public URL: url.slice(ANCESTRY_MEDIA_PUBLIC_URL.length + 1)
 */

async function r2Put(key: string, body: ArrayBuffer, contentType: string): Promise<string> {
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

/**
 * Upload a media file and return its public URL.
 */
export async function uploadMedia(file: File, key: string): Promise<string> {
  const buf = await file.arrayBuffer();
  return r2Put(key, buf, file.type);
}

/**
 * Delete a media file by its public URL.
 * Silently ignores errors (file may already be deleted).
 */
export async function deleteMediaByUrl(url: string): Promise<void> {
  try {
    await r2Delete(url);
  } catch (err) {
    console.warn("[storage] deleteMediaByUrl failed silently:", err);
  }
}

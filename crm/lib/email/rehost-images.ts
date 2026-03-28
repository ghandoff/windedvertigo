/**
 * Rewrites external <img src="..."> URLs in HTML email bodies to R2-hosted
 * equivalents. This ensures images load in Gmail regardless of the original
 * CDN (Canva, etc.) and prevents broken images caused by CDN auth or expiry.
 *
 * Skips: data URIs, already-hosted R2 URLs, and URLs that fail to fetch.
 * All failures are non-fatal — the original src is preserved.
 */

import { uploadAsset } from "@/lib/r2/upload";
import { R2_PUBLIC_URL } from "@/lib/r2/client";

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

function guessContentType(url: string, fallback = "image/jpeg"): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[ext] ?? fallback;
}

function fileExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return map[mime.split(";")[0].trim()] ?? "jpg";
}

/** Fetch one external image and upload it to R2. Returns the R2 public URL. */
async function rehostOne(src: string): Promise<string> {
  const res = await fetch(src, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WindedVertigo/1.0)" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`fetch ${src} → ${res.status}`);

  const contentType = res.headers.get("content-type") ?? guessContentType(src);
  const ext = fileExtFromMime(contentType);
  const key = `email-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await res.arrayBuffer());

  return uploadAsset(buffer, key, contentType);
}

/**
 * Find all external <img src="…"> URLs in `html`, upload them to R2, and
 * return the HTML with src attributes rewritten to R2 URLs.
 *
 * Images are processed concurrently (max 8 at a time). Failures are logged
 * and the original src is kept so the email still sends.
 */
export async function rehostImages(html: string): Promise<string> {
  if (!R2_PUBLIC_URL) return html; // R2 not configured — skip silently

  // Extract unique external src values (not data URIs, not already on R2)
  const srcPattern = /(<img[^>]+src=["'])([^"']+)(["'])/gi;
  const toRehost = new Map<string, string>(); // original src → R2 url (populated)

  let match: RegExpExecArray | null;
  while ((match = srcPattern.exec(html)) !== null) {
    const src = match[2];
    if (
      src.startsWith("data:") ||
      src.startsWith(R2_PUBLIC_URL) ||
      toRehost.has(src)
    ) continue;
    if (/^https?:\/\//i.test(src)) toRehost.set(src, src); // placeholder
  }

  if (toRehost.size === 0) return html;

  // Upload all images concurrently, batched 8 at a time
  const entries = [...toRehost.keys()];
  for (let i = 0; i < entries.length; i += 8) {
    const batch = entries.slice(i, i + 8);
    await Promise.all(
      batch.map(async (src) => {
        try {
          const r2Url = await rehostOne(src);
          toRehost.set(src, r2Url);
        } catch (err) {
          console.warn("[rehost-images] skipped:", src, err instanceof Error ? err.message : err);
        }
      }),
    );
  }

  // Rewrite src attributes — only where we successfully uploaded
  return html.replace(
    /(<img[^>]+src=["'])([^"']+)(["'])/gi,
    (full, prefix, src, suffix) => {
      const r2Url = toRehost.get(src);
      if (!r2Url || r2Url === src) return full; // unchanged
      return `${prefix}${r2Url}${suffix}`;
    },
  );
}

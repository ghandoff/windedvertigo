/**
 * Conference cover image fetcher.
 *
 * Cascade (cheapest to most expensive):
 *   1. Fetch URL HEAD → parse og:image / twitter:image from <meta> tags
 *   2. If found: download the image + upload to R2 → return R2 URL
 *   3. If not found and CF Browser Rendering is available: take screenshot → upload → return R2 URL
 *   4. Fallback: return orgLogoUrl if provided, else null
 *
 * Called by POST /api/events/{id}/cover inside ctx.waitUntil() so the
 * caller doesn't block.
 *
 * Env vars required:
 *   CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL
 *   (all already set for the existing uploadAsset() calls)
 *
 * The BROWSER binding is only needed for the CF Browser Rendering step.
 * The cascade gracefully skips that step when the binding is absent (e.g.
 * local dev or Workers plans without the Browser Rendering add-on).
 */

import { uploadAsset } from "@/lib/r2/upload";

// ── types ──────────────────────────────────────────────────────────

export interface CoverImageOptions {
  /** The conference website URL to fetch. */
  url: string;
  /** Stable slug used as the R2 key prefix (e.g. the event notion_page_id). */
  eventId: string;
  /** Optional fallback if no og:image and no Browser Rendering. */
  orgLogoUrl?: string | null;
  /**
   * CF Browser Rendering binding from getCloudflareContext().env.BROWSER.
   * Optional — cascade skips the screenshot step when absent.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserBinding?: any;
}

// ── og:image extraction ─────────────────────────────────────────────

/**
 * Fetch the HTML at the given URL and return the first og:image or
 * twitter:image value found. Returns null on any error.
 */
async function extractOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; wv-port/1.0; +https://port.windedvertigo.com)",
      },
      // Don't follow infinite redirects
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();

    // og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]) return ogMatch[1].trim();

    // twitter:image
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch?.[1]) return twMatch[1].trim();

    return null;
  } catch {
    return null;
  }
}

// ── image download + R2 upload ──────────────────────────────────────

async function downloadAndUpload(
  imageUrl: string,
  r2Key: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; wv-port/1.0; +https://port.windedvertigo.com)",
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    // Only accept images
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    // Skip oversized images (> 5 MB)
    if (buffer.byteLength > 5 * 1024 * 1024) return null;

    const ext = contentType.includes("png") ? "png"
               : contentType.includes("webp") ? "webp"
               : contentType.includes("gif") ? "gif"
               : "jpg";

    return await uploadAsset(buffer, `${r2Key}.${ext}`, contentType);
  } catch {
    return null;
  }
}

// ── CF Browser Rendering screenshot ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function takeScreenshot(pageUrl: string, browserBinding: any, r2Key: string): Promise<string | null> {
  let puppeteer: typeof import("@cloudflare/puppeteer") | null = null;
  try {
    puppeteer = await import("@cloudflare/puppeteer");
  } catch {
    // Package not available — skip screenshot step.
    return null;
  }

  let browser = null;
  try {
    browser = await puppeteer.default.launch(browserBinding);
    const page = await browser.newPage();

    // Viewport mimics a conference event card aspect ratio (16:9)
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 15_000 });

    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 80,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    }) as Buffer;

    return await uploadAsset(screenshot, `${r2Key}.jpg`, "image/jpeg");
  } catch {
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

// ── main export ─────────────────────────────────────────────────────

/**
 * Fetch or generate a cover image for a conference event.
 * Returns the R2 public URL, or null if all steps fail.
 */
export async function fetchCoverImage(opts: CoverImageOptions): Promise<string | null> {
  const r2Key = `conferences/${opts.eventId}/cover`;

  // Step 1: Try og:image meta tag
  const ogImageUrl = await extractOgImage(opts.url);
  if (ogImageUrl) {
    const uploaded = await downloadAndUpload(ogImageUrl, r2Key);
    if (uploaded) return uploaded;
  }

  // Step 2: CF Browser Rendering screenshot (if binding is available)
  if (opts.browserBinding) {
    const screenshot = await takeScreenshot(opts.url, opts.browserBinding, r2Key);
    if (screenshot) return screenshot;
  }

  // Step 3: Fallback to org logo
  return opts.orgLogoUrl ?? null;
}

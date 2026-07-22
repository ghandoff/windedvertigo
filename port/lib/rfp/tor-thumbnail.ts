/**
 * TOR thumbnail — a screenshot of an RFP's TOR document (or its source page) so
 * a human can visually confirm a real Terms-of-Reference is attached, and spot
 * when a "TOR" is actually just a website / aggregator listing.
 *
 * Reuses the Cloudflare Browser Rendering pattern from
 * lib/conferences/cover-image.ts (takeScreenshot). Headless Chrome renders PDF
 * first-pages in its built-in viewer, so no PDF rasteriser is needed.
 * Fail-open: returns null on any error (missing binding, unreachable URL, etc.).
 */

import { uploadAsset } from "@/lib/r2/upload";
import { setRfpTorThumbnail } from "@/lib/supabase/rfp-opportunities";

/**
 * Screenshot `targetUrl` (a TOR PDF, doc, or web page) and store it to R2.
 * Returns the public R2 URL, or null if rendering isn't available / fails.
 * The key is timestamped so a refresh produces a new URL (no stale-CDN issues).
 */
export async function generateTorThumbnail(
  rfpId: string,
  targetUrl: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserBinding: any,
): Promise<string | null> {
  if (!browserBinding || !targetUrl || !/^https?:\/\//i.test(targetUrl)) return null;

  let puppeteer: typeof import("@cloudflare/puppeteer") | null = null;
  try {
    puppeteer = await import("@cloudflare/puppeteer");
  } catch {
    return null; // package unavailable (e.g. local dev without the binding)
  }

  let browser = null;
  try {
    browser = await puppeteer.default.launch(browserBinding);
    const page = await browser.newPage();
    // Portrait-ish viewport so a document's first page reads well as a thumbnail.
    await page.setViewport({ width: 1000, height: 1294 });
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 20_000 });

    const shot = (await page.screenshot({
      type: "jpeg",
      quality: 75,
      clip: { x: 0, y: 0, width: 1000, height: 1294 },
    })) as Buffer;

    return await uploadAsset(shot, `rfp-thumbnails/${rfpId}/${Date.now()}.jpg`, "image/jpeg");
  } catch {
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Generate + persist a TOR thumbnail in the background (Cloudflare `waitUntil`)
 * so callers (ingest, upload) don't block on the ~2-20s screenshot. Grabs the
 * Browser binding from the CF context. Fail-open — no-op if binding absent.
 */
export async function scheduleTorThumbnail(
  rfpId: string,
  targetUrl: string | null | undefined,
): Promise<void> {
  if (!targetUrl) return;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = (await getCloudflareContext({ async: true })) as {
      env?: { BROWSER?: unknown };
      ctx?: { waitUntil?: (p: Promise<unknown>) => void };
    };
    const binding = cf.env?.BROWSER;
    if (!binding) return;
    const work = (async () => {
      const url = await generateTorThumbnail(rfpId, targetUrl, binding);
      if (url) await setRfpTorThumbnail(rfpId, url);
    })();
    if (cf.ctx?.waitUntil) cf.ctx.waitUntil(work);
    else await work;
  } catch (err) {
    console.warn("[tor-thumbnail] scheduleTorThumbnail failed:", err);
  }
}

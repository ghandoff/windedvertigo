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

const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

/** Best-effort check whether the target is a PDF (extension or content-type). */
async function isPdfTarget(url: string): Promise<boolean> {
  if (/\.pdf(\?|$)/i.test(url)) return true;
  try {
    const r = await fetch(url, { method: "HEAD" });
    return (r.headers.get("content-type") ?? "").toLowerCase().includes("application/pdf");
  } catch {
    return false;
  }
}

/**
 * Render page 1 of a PDF to a JPEG using pdf.js INSIDE the headless browser.
 * The bytes are fetched server-side (r2.dev sends no CORS header, so an in-page
 * fetch would be blocked) and handed to pdf.js as a byte array. This captures
 * the real first page — screenshotting the raw PDF URL only captures Chrome's
 * dark PDF-viewer chrome. Returns null on any failure.
 */
async function renderPdfFirstPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  targetUrl: string,
): Promise<Buffer | null> {
  const res = await fetch(targetUrl);
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 12_000_000) return null;
  const b64 = bytes.toString("base64");

  await page.setContent(
    `<!doctype html><html><head>` +
      `<script src="${PDFJS_BASE}/pdf.min.js"></script>` +
      `</head><body style="margin:0;background:#ffffff"><canvas id="c"></canvas></body></html>`,
    { waitUntil: "load", timeout: 20_000 },
  );

  const ok: boolean = await page.evaluate(
    async (b64data: string, workerSrc: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lib = (window as any).pdfjsLib;
        if (!lib) return false;
        lib.GlobalWorkerOptions.workerSrc = workerSrc;
        const raw = atob(b64data);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        const pdf = await lib.getDocument({ data: arr }).promise;
        const p = await pdf.getPage(1);
        const viewport = p.getViewport({ scale: 1.4 });
        const canvas = document.getElementById("c") as HTMLCanvasElement | null;
        if (!canvas) return false;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        await p.render({ canvasContext: ctx, viewport }).promise;
        return true;
      } catch {
        return false;
      }
    },
    b64,
    `${PDFJS_BASE}/pdf.worker.min.js`,
  );
  if (!ok) return null;

  const el = await page.$("#c");
  if (!el) return null;
  return (await el.screenshot({ type: "jpeg", quality: 75 })) as Buffer;
}

/**
 * Screenshot `targetUrl` (a TOR PDF, doc, or web page) and store it to R2.
 * PDFs are rendered via pdf.js (real first page); everything else is a straight
 * page screenshot. Returns the public R2 URL, or null on failure — we never
 * store a misleading image (e.g. a dark PDF-viewer capture).
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

    let shot: Buffer | null = null;
    if (await isPdfTarget(targetUrl)) {
      // PDF → render the real first page. On failure return null rather than
      // fall back to a dark PDF-viewer screenshot.
      shot = await renderPdfFirstPage(page, targetUrl);
    } else {
      await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 20_000 });
      shot = (await page.screenshot({
        type: "jpeg",
        quality: 75,
        clip: { x: 0, y: 0, width: 1000, height: 1294 },
      })) as Buffer;
    }

    if (!shot) return null;
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

/**
 * Source → text resolver for the listen library.
 *
 * Runs on the port (Next.js / Node runtime) at submit time — NOT in the
 * port-jobs CF Worker — so it can use the Google service-account libs and the
 * Node-only PDF/DOCX path. The resolved text is stored in R2 and the job
 * consumer only does TTS. Keeping extraction here avoids running pdf-parse /
 * gdrive / notion inside the queue consumer, which lacks that runtime + env.
 *
 * v1 implements Google Docs + uploaded files (PDF/DOCX/TXT) + web URLs.
 * Notion pages are a phase-B addition (dispatcher is ready for them).
 */

import { exportDocAsText } from "@/lib/gdrive";

export interface ResolvedSource {
  title: string;
  text: string;
  sourceType: "google-doc" | "upload" | "url" | "notion";
  sourceRef: string; // doc id, file name, url, or page id
}

/** Stable hash of the render inputs — identical (text + settings + engine)
 *  short-circuits to the existing render via the dedupe cache. */
export async function contentHash(
  text: string,
  opts: { cleanLevel: string; condense: boolean; provider: string },
): Promise<string> {
  const input = `${opts.provider}|${opts.cleanLevel}|${opts.condense ? 1 : 0}|${text}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pull a Google Docs document id out of a share URL. */
export function parseGoogleDocId(url: string): string | null {
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Resolve a Google Doc by share URL. `subject` impersonates the member who
 *  owns/shared the doc (service-account domain-wide delegation). */
export async function resolveGoogleDoc(
  url: string,
  opts: { subject?: string; title?: string } = {},
): Promise<ResolvedSource> {
  const docId = parseGoogleDocId(url);
  if (!docId) throw new Error("could not parse a Google Doc id from that url");
  const text = await exportDocAsText(docId, { subject: opts.subject });
  if (!text) {
    throw new Error(
      "could not read that Google Doc — make sure you can open it in your own Google account (we read it as you)",
    );
  }
  return {
    title: opts.title || firstLineTitle(text) || "untitled doc",
    text,
    sourceType: "google-doc",
    sourceRef: docId,
  };
}

/** Resolve a public web article by URL. Basic readability: fetch HTML, drop
 *  scripts/styles/nav/markup, keep text. Good enough for v1; an LLM reading-prep
 *  pass can refine later. */
export async function resolveUrl(url: string): Promise<ResolvedSource> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; wv-listen/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`could not fetch that url (${res.status})`);
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url;
  const text = htmlToText(html);
  if (text.length < 200) throw new Error("couldn't extract readable text from that page");
  return { title, text, sourceType: "url", sourceRef: url };
}

/** Wrap already-extracted upload text (the submit route does the PDF/DOCX/TXT
 *  extraction via the existing /api/extract-text path). */
export function resolveUpload(text: string, fileName: string): ResolvedSource {
  return {
    title: fileName.replace(/\.[^.]+$/, ""),
    text,
    sourceType: "upload",
    sourceRef: fileName,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────

function firstLineTitle(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

/** Crude HTML → text: strip non-content tags, unwrap the rest, decode basics. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|figure)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

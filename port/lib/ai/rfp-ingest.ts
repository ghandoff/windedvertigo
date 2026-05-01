/**
 * Shared RFP ingest logic — dedup → AI triage → Notion create → URL enrichment.
 *
 * Used by both:
 *   - POST /api/rfp-radar/ingest  (webhook / Gmail scanner)
 *   - POST /api/rfp-radar/poll-feedly  (RSS poller, calls this directly)
 *
 * Part of RFP Lighthouse.
 *
 * Dedup strategy: if a dedupKey (or url) is provided, scan the 100 most-recent
 * opportunities for an exact match before running AI triage.
 *
 * URL enrichment: after creating the opportunity, if the stored url is a real
 * HTTP(S) link and triage left dueDate or requirementsSnapshot thin, we fetch
 * the page and run a targeted Claude call to fill the gaps.
 */

import Anthropic from "@anthropic-ai/sdk";
import { triageRfpOpportunity } from "./rfp-triage";
import { queryRfpOpportunities, createRfpOpportunity, updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { callClaude, parseJsonResponse } from "./client";
import { uploadAsset } from "@/lib/r2/upload";
import type { RfpSource } from "@/lib/notion/types";
import type { RfpTriageResult } from "./rfp-triage";

/** TOR status reported in the ingest outcome — used by the Slack notifier. */
export type TorStatus = "pdf" | "inline" | "missing";

export interface IngestInput {
  title: string;
  body: string;
  url?: string;
  /**
   * Stable key used ONLY for deduplication — never stored as the opportunity URL.
   * Use this when the dedup identity differs from the canonical procurement URL
   * (e.g. pass `gmail:message:{id}` here while passing the extracted RFP link as `url`).
   * Falls back to `url` if omitted.
   */
  dedupKey?: string;
  source?: RfpSource;
}

export type IngestOutcome =
  | {
      created: true;
      id: string;
      fitScore: string;
      triage: RfpTriageResult;
      /** Canonical URL of the opportunity (same value stored on the Notion page). */
      url?: string;
      /**
       * Where the TOR ended up after ingest:
       *   - "pdf"     — a PDF / doc URL is recorded in rfpDocumentUrl (from URL enrichment)
       *   - "inline"  — the announcement body WAS the full TOR; we stored it as .txt in R2
       *   - "missing" — no TOR found; team needs to track one down manually
       */
      torStatus: TorStatus;
      /** The rfpDocumentUrl if one was recorded (pdf or inline); omitted when missing. */
      torUrl?: string;
    }
  | { created: false; skipped: string; triage?: RfpTriageResult; existingId?: string };

// ── URL sanitisation ──────────────────────────────────────

/**
 * Unwrap a Google redirect URL and return the real destination.
 *
 * Google News RSS feeds and Google Alerts both wrap outbound links through
 * google.com/url with the real URL in the `url=` or `q=` query param:
 *   https://www.google.com/url?rct=j&sa=t&url=https://TARGET&ct=ga&...
 *   https://www.google.com/url?q=https://TARGET&sa=U&...
 *
 * Feedly delivers these unwrapped directly from the feed, so the value stored
 * in Notion is a google.com/url redirect that fails when opened outside Gmail.
 * This runs at the ingest boundary so every source benefits.
 */
export function sanitiseIngestUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    // Step 1: HTML-decode any entities before URL parsing.
    // Feedly/RSS feeds sometimes deliver URLs with &amp; instead of & — this
    // causes URLSearchParams to see "amp;url=" as the key rather than "url=",
    // so the Google redirect unwrap silently falls back to the original URL.
    const decoded = url
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    // Step 2: Unwrap Google redirect wrappers (google.com/url?url=TARGET or ?q=TARGET).
    if (!decoded.includes("google.com/url")) return decoded;
    const parsed = new URL(decoded);
    const dest = parsed.searchParams.get("url") ?? parsed.searchParams.get("q");
    return dest?.startsWith("http") ? dest : decoded;
  } catch {
    return url;
  }
}

// ── URL enrichment ────────────────────────────────────────

interface EnrichmentResult {
  dueDate?: string;
  requirementsSnapshot?: string;
  /** URL of the TOR/RFP PDF discovered from the funder webpage, if any. */
  torDocumentUrl?: string;
}

/** Strip HTML and truncate for Claude enrichment calls. */
function stripAndTruncate(html: string, maxLen = 4000): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Extract a head+tail window from page text for deadline detection.
 *
 * Procurement pages follow a predictable structure:
 *   background → scope of work → requirements → **deadline** → contact info
 *
 * Taking only the first N characters misses the deadline section almost every
 * time. This function takes the first 5 000 chars (scope context) PLUS the
 * last 3 000 chars (where submission dates, closing dates, and contact info
 * live) separated by a […] marker so Claude understands the gap.
 */
function extractForDateSearch(html: string): string {
  const full = stripAndTruncate(html, 500_000); // strip only, no meaningful length cap
  const HEAD = 5_000;
  const TAIL = 3_000;
  if (full.length <= HEAD + TAIL) return full;
  return full.slice(0, HEAD) + " […] " + full.slice(-TAIL);
}

/**
 * Strip HTML for the inline-TOR pipeline, but preserve paragraph/line breaks
 * so the stored .txt stays readable. Converts block-level closers and <br>
 * to newlines before nuking remaining tags. Collapses 3+ blank lines to 2.
 */
function stripPreservingBreaks(html: string, maxLen = 200_000): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    // Convert common block-level boundaries and <br> to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    // Drop every remaining tag
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    // Collapse horizontal whitespace (but keep newlines)
    .replace(/[ \t]+/g, " ")
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim trailing whitespace on each line
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, maxLen);
}

// ── TOR PDF discovery ─────────────────────────────────────

interface TorResult {
  requirementsSnapshot?: string;
  dueDate?: string;
  estimatedValue?: number;
  torUrl?: string;
}

/** Parsed anchor tag with resolved absolute URL + cleaned display text. */
interface AnchorCandidate {
  url: string;
  text: string;
}

/** Keywords that suggest a PDF link is a TOR / RFP document rather than a logo or brochure. */
const TOR_KEYWORDS = /\b(tor|rfp|rfq|rfi|terms[_-]of[_-]reference|terms.of.reference|request.for|procurement|tender|solicitation|appel.d.offres)\b/i;

/** Extensions we treat as downloadable document candidates. */
const DOC_EXTENSION_RE = /\.(pdf|docx?|zip)(?:[?#]|$)/i;
const PDF_EXTENSION_RE = /\.pdf(?:[?#]|$)/i;

/** Strip HTML tags from anchor inner content and collapse whitespace. */
function cleanAnchorText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse every `<a href="...">text</a>` from a page, resolve relative URLs against
 * baseUrl, and filter to plausible TOR/document candidates. Tolerates malformed
 * HTML by catching URL resolution errors individually. Returns [] on empty input.
 */
function extractAnchorCandidates(html: string, baseUrl: string): AnchorCandidate[] {
  if (!html) return [];
  const anchorRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const out: AnchorCandidate[] = [];
  for (const m of html.matchAll(anchorRe)) {
    const rawHref = m[1];
    const rawText = m[2] ?? "";
    // Skip anchors, javascript:, mailto:, tel:
    if (!rawHref || /^(javascript:|mailto:|tel:|#)/i.test(rawHref)) continue;
    let absolute: string;
    try {
      absolute = new URL(rawHref, baseUrl).href;
    } catch {
      continue;
    }
    // Only http(s) schemes for fetches downstream
    if (!/^https?:/i.test(absolute)) continue;
    const text = cleanAnchorText(rawText);
    const hrefLooksLikeDoc = DOC_EXTENSION_RE.test(absolute);
    const hrefHasKeyword = TOR_KEYWORDS.test(absolute);
    const textHasKeyword = text ? TOR_KEYWORDS.test(text) : false;
    if (!hrefLooksLikeDoc && !hrefHasKeyword && !textHasKeyword) continue;
    // Dedup by absolute URL
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    out.push({ url: absolute, text });
  }
  return out;
}

/**
 * Ask Claude to pick the best TOR link from a list. Returns the 0-based index,
 * or null if Claude says nothing looks like a TOR, or null on any failure
 * (caller falls back to regex-scored top candidate).
 */
async function claudePickTorLink(
  candidates: AnchorCandidate[],
): Promise<{ index: number | null; reason: string } | null> {
  try {
    const list = candidates
      .slice(0, 15)
      .map((c, i) => {
        const shortText = (c.text || "(no text)").slice(0, 80);
        return `[${i}] ${c.url} — ${shortText}`;
      })
      .join("\n");
    const result = await callClaude({
      feature: "rfp-triage",
      system: "You are a procurement analyst. Return ONLY valid JSON, no other text.",
      userMessage: `Given this list of links from an RFP/funder webpage, identify the single link most likely to be the TOR (Terms of Reference), RFP document, or full proposal details. Respond with ONLY valid JSON:
{"pickIndex": <integer index 0-based>, "reason": "<one sentence>"}
If none of the links are plausibly a TOR, respond with:
{"pickIndex": null, "reason": "<why>"}

Links:
${list}`,
      userId: "automation",
      maxTokens: 256,
      temperature: 0.1,
    });
    const parsed = parseJsonResponse<{ pickIndex: number | null; reason?: string }>(result.text);
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    if (parsed.pickIndex === null || parsed.pickIndex === undefined) {
      return { index: null, reason };
    }
    if (typeof parsed.pickIndex !== "number" || !Number.isInteger(parsed.pickIndex)) {
      return null;
    }
    if (parsed.pickIndex < 0 || parsed.pickIndex >= candidates.length) {
      return null;
    }
    return { index: parsed.pickIndex, reason };
  } catch {
    return null;
  }
}

/** Download a URL with the shared 10MB / 15s guardrails. Returns null on any failure. */
async function fetchDocument(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; rfp-enrichment-bot/1.0)" },
    });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > 10_000_000) return null;
    const contentType = res.headers.get("content-type") ?? "";
    return { buffer: Buffer.from(bytes), contentType };
  } catch {
    return null;
  }
}

/** Extract TOR fields from a downloaded PDF buffer via Claude's DocumentBlockParam. */
async function extractTorFromPdf(pdfBuffer: Buffer): Promise<Omit<TorResult, "torUrl">> {
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: "You are a procurement analyst. Return ONLY valid JSON, no other text.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBuffer.toString("base64"),
              },
            } as Anthropic.DocumentBlockParam,
            {
              type: "text",
              text: `Extract procurement details from this TOR/RFP document. Return JSON with exactly these fields:
{
  "requirementsSnapshot": "5-7 sentences covering: what services are being procured, key objectives, scope of work, deliverables, and any geographic or population focus. Write in plain English.",
  "dueDate": "YYYY-MM-DD format. Scan every page for: deadline, submission deadline, closing date, due date, proposals due, applications close, receipt by, submit by, last date for submission. Common formats include '15 May 2026', 'May 15 2026', '30/04/2026', '2026-04-30'. Return null only if no date appears anywhere in the document.",
  "estimatedValue": integer USD budget/contract value or null if not found
}`,
            },
          ],
        },
      ],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]) as Omit<TorResult, "torUrl">;
  } catch {
    return {};
  }
}

/**
 * Given the raw HTML of a funder webpage, find all plausible TOR/RFP document
 * links (by href extension, URL keyword, or anchor text keyword), use Claude
 * to pick the best one when there's ambiguity, download it, and extract
 * structured fields via Claude's native PDF document support.
 *
 * Fail-open: returns {} or partial {torUrl} on any error — never throws.
 *
 * @param pageHtml raw landing-page HTML
 * @param baseUrl URL the HTML was fetched from (for resolving relative links)
 * @param depth internal recursion guard; caller should leave at default 0
 */
async function discoverAndExtractTor(
  pageHtml: string,
  baseUrl: string,
  depth = 0,
): Promise<TorResult> {
  // 1. Parse every anchor, filter to plausible document candidates
  let candidates: AnchorCandidate[] = [];
  try {
    candidates = extractAnchorCandidates(pageHtml, baseUrl);
  } catch {
    // Regex parse shouldn't throw, but defend anyway
    return {};
  }
  console.log("[rfp-ingest/tor] found", candidates.length, "candidates (depth=" + depth + ")", "base=" + baseUrl);
  if (candidates.length === 0) return {};

  // 2. Build regex-scored fallback order (keyword hits first, stable otherwise)
  const regexScored = [...candidates].sort((a, b) => {
    const aScore = (TOR_KEYWORDS.test(a.url) ? 2 : 0) + (TOR_KEYWORDS.test(a.text) ? 1 : 0);
    const bScore = (TOR_KEYWORDS.test(b.url) ? 2 : 0) + (TOR_KEYWORDS.test(b.text) ? 1 : 0);
    return bScore - aScore;
  });

  // 3. Choose a candidate
  let chosen: AnchorCandidate;
  const pdfCandidates = candidates.filter((c) => PDF_EXTENSION_RE.test(c.url));
  if (candidates.length === 1) {
    chosen = candidates[0];
    console.log("[rfp-ingest/tor] single candidate, using directly:", chosen.url);
  } else if (pdfCandidates.length === 1 && candidates.length > 1) {
    // Exactly one true PDF among mixed candidates — prefer it, skip Claude pick
    chosen = pdfCandidates[0];
    console.log("[rfp-ingest/tor] single PDF among mixed candidates, using directly:", chosen.url);
  } else {
    // 2+ candidates — ask Claude to pick (max one link-picker call per ingest)
    const pick = await claudePickTorLink(candidates);
    if (pick && pick.index !== null) {
      chosen = candidates[pick.index];
      console.log("[rfp-ingest/tor] claude picked [" + pick.index + "]:", pick.reason, "->", chosen.url);
    } else if (pick && pick.index === null) {
      // Claude explicitly said none look right — fall back to regex-sorted top
      console.log("[rfp-ingest/tor] claude declined (" + pick.reason + "); falling back to regex top:", regexScored[0].url);
      chosen = regexScored[0];
    } else {
      // Claude call failed / bad JSON — fall back to regex-sorted top
      console.log("[rfp-ingest/tor] claude pick failed; falling back to regex top:", regexScored[0].url);
      chosen = regexScored[0];
    }
  }

  // 4. Download the chosen candidate
  const lowerUrl = chosen.url.toLowerCase();
  const looksLikePdf = PDF_EXTENSION_RE.test(lowerUrl);
  const looksLikeDoc = /\.docx?(?:[?#]|$)/i.test(lowerUrl);

  // 4a. .doc/.docx — we can't extract via Claude's native PDF block. Record URL and return.
  if (looksLikeDoc) {
    console.log("[rfp-ingest/tor] doc/docx not extractable, recording url only:", chosen.url);
    return { torUrl: chosen.url };
  }

  console.log("[rfp-ingest/tor] downloading", chosen.url);
  const downloaded = await fetchDocument(chosen.url);
  if (!downloaded) {
    // Fetch failed or file too large — still surface the URL if it looked like a doc
    if (looksLikePdf || looksLikeDoc) {
      console.log("[rfp-ingest/tor] download failed/oversize, returning url only");
      return { torUrl: chosen.url };
    }
    console.log("[rfp-ingest/tor] download failed for non-doc url, returning empty");
    return {};
  }

  const ct = downloaded.contentType.toLowerCase();
  const isPdfByContent = ct.includes("application/pdf");
  const isHtmlByContent = ct.includes("text/html") || ct.includes("application/xhtml");

  // 4b. PDF either by extension or by sniffed content-type → extract
  if (looksLikePdf || isPdfByContent) {
    const extracted = await extractTorFromPdf(downloaded.buffer);
    const gotFields =
      (extracted.dueDate ? 1 : 0) +
      (extracted.requirementsSnapshot ? 1 : 0) +
      (extracted.estimatedValue != null ? 1 : 0);
    console.log("[rfp-ingest/tor] extracted fields", gotFields, "/ 3 from", chosen.url);
    return { ...extracted, torUrl: chosen.url };
  }

  // 4c. HTML landing-on-landing → one recursion level to find the real doc
  if (isHtmlByContent && depth < 1) {
    console.log("[rfp-ingest/tor] recursing into html page:", chosen.url);
    let nestedHtml = "";
    try {
      nestedHtml = downloaded.buffer.toString("utf8");
    } catch {
      // buffer->string shouldn't fail, but defend anyway
      return { torUrl: chosen.url };
    }
    try {
      const nested = await discoverAndExtractTor(nestedHtml, chosen.url, depth + 1);
      // Prefer nested torUrl if found, but always surface SOMETHING if we have it
      if (nested.torUrl || nested.requirementsSnapshot || nested.dueDate || nested.estimatedValue != null) {
        return nested;
      }
    } catch {
      // fall through — recursion never blocks
    }
    return { torUrl: chosen.url };
  }

  // 4d. Unknown content-type at max depth — surface URL, no extraction
  console.log("[rfp-ingest/tor] non-pdf non-html content-type (" + ct + ") at depth " + depth + ", url only");
  return { torUrl: chosen.url };
}

export async function enrichFromUrl(
  url: string,
  existingDueDate: string | undefined,
  existingSnapshot: string,
  alreadyHasTorUrl: boolean = false,
): Promise<EnrichmentResult> {
  // Only fetch if there's still something to discover
  const needsDueDate = !existingDueDate;
  const needsBetterSnapshot = !existingSnapshot || existingSnapshot.length < 80;
  const needsTorDoc = !alreadyHasTorUrl;
  if (!needsDueDate && !needsBetterSnapshot && !needsTorDoc) return {};

  // ── Step 1: Direct-PDF case — URL itself is a PDF ────────────────────────
  // Build a synthetic page HTML pointing to the URL itself so discoverAndExtractTor
  // can handle it through the same code path.
  if (url.toLowerCase().includes(".pdf")) {
    try {
      const direct = await discoverAndExtractTor(`<a href="${url}">TOR</a>`, url);
      const out: EnrichmentResult = {};
      if (direct.torUrl) out.torDocumentUrl = direct.torUrl;
      if (needsDueDate && direct.dueDate) out.dueDate = direct.dueDate;
      if (needsBetterSnapshot && direct.requirementsSnapshot) out.requirementsSnapshot = direct.requirementsSnapshot;
      // If we got everything from the PDF, skip webpage fetch
      if ((!needsDueDate || out.dueDate) && (!needsBetterSnapshot || out.requirementsSnapshot)) {
        return out;
      }
    } catch {
      // Fall through to webpage fetch
    }
  }

  // ── Step 2: Fetch the funder webpage ─────────────────────────────────────
  let rawHtml: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; rfp-enrichment-bot/1.0)" },
    });
    if (!res.ok) return {};
    rawHtml = await res.text();
  } catch {
    return {};
  }

  const out: EnrichmentResult = {};

  // ── Step 3: Discover and extract TOR PDF from the page ───────────────────
  try {
    const tor = await discoverAndExtractTor(rawHtml, url);
    if (tor.torUrl) out.torDocumentUrl = tor.torUrl;
    if (needsDueDate && tor.dueDate) out.dueDate = tor.dueDate;
    if (needsBetterSnapshot && tor.requirementsSnapshot) out.requirementsSnapshot = tor.requirementsSnapshot;
  } catch {
    // TOR discovery failure never blocks enrichment
  }

  // ── Step 4: Fall back to HTML text extraction for still-missing fields ───
  const stillNeedsDueDate = needsDueDate && !out.dueDate;
  const stillNeedsSnapshot = needsBetterSnapshot && !out.requirementsSnapshot;

  if (stillNeedsDueDate || stillNeedsSnapshot) {
    // Use head+tail extraction so we capture both scope context (head) and
    // the submission/deadline section (tail) in one Claude call.
    const pageText = stillNeedsDueDate ? extractForDateSearch(rawHtml) : stripAndTruncate(rawHtml);
    if (pageText) {
      try {
        const result = await callClaude({
          feature: "rfp-triage",
          system: "You are a procurement data extraction assistant. Extract structured information and return ONLY valid JSON.",
          userMessage: `Extract from this procurement page. Return JSON with exactly these fields:
{
  "dueDate": "YYYY-MM-DD format. Look for: deadline, submission deadline, due date, closing date, proposals due, applications close, receipt by, submit by, last date for submission. Common formats on the page include '15 May 2026', 'May 15 2026', '30 April', '2026-04-30'. Return null only if no date is found anywhere.",
  "requirementsSnapshot": "2-3 sentence summary of what work/services are being procured, or null if unclear"
}

Page content (head and tail shown to capture both context and deadline section):
${pageText}`,
          userId: "automation",
          maxTokens: 300,
          temperature: 0.1,
        });

        const parsed = parseJsonResponse<{ dueDate?: string; requirementsSnapshot?: string }>(result.text);
        if (stillNeedsDueDate && parsed.dueDate) out.dueDate = parsed.dueDate;
        if (stillNeedsSnapshot && parsed.requirementsSnapshot) out.requirementsSnapshot = parsed.requirementsSnapshot;
      } catch {
        // HTML extraction failure is non-fatal
      }
    }
  }

  return out;
}

// ── inline TOR detection ──────────────────────────────────

interface InlineTorInput {
  /** Raw body as provided to ingestOpportunity (may contain HTML). */
  body: string;
  /** Notion page id of the just-created opportunity — used in the R2 key. */
  rfpId: string;
  /** Opportunity name for logging. */
  opportunityName: string;
}

interface InlineTorResult {
  /** Public R2 URL of the stored .txt representation. */
  torUrl: string;
  /** 3–5 sentence snapshot Claude extracted, if any. */
  requirementsSnapshot?: string;
}

/**
 * Detect whether the announcement body IS a full Terms of Reference (not just
 * a link to one). If yes, store a plain-text copy to R2 and return the URL +
 * optional snapshot. Fail-open: any error at any step → logs + returns null,
 * never throws. Gated by `body.length >= 1500` to skip short announcements
 * without a Claude call.
 */
async function detectAndStoreInlineTor(
  input: InlineTorInput,
): Promise<InlineTorResult | null> {
  const { body, rfpId, opportunityName } = input;
  const logPrefix = "[rfp-ingest/inline-tor]";

  try {
    // 1. Quick length gate — avoid a Claude call on brief announcements.
    if (!body || body.length < 1500) {
      console.log(`${logPrefix} body too short (${body?.length ?? 0} chars), skipping`);
      return null;
    }

    // 2. Ask Claude whether the body IS a full TOR.
    const cleanedForClaude = stripAndTruncate(body, 10_000);
    if (!cleanedForClaude) {
      console.log(`${logPrefix} body empty after stripping, skipping`);
      return null;
    }

    let detection: { isFullTor?: boolean; reason?: string; extractedSnapshot?: string | null };
    try {
      const result = await callClaude({
        feature: "rfp-triage",
        system: "You are a procurement analyst. Return ONLY valid JSON, no other text.",
        userMessage: `You are a procurement analyst. Given this text, decide whether it is a FULL Terms of Reference (TOR) / RFP document (not just an announcement linking to one). A full TOR typically contains multiple sections such as: background, scope of work, deliverables, timeline, eligibility, submission requirements.

Respond with ONLY valid JSON:
{"isFullTor": true|false, "reason": "<one sentence>", "extractedSnapshot": "<3-5 sentence summary if isFullTor is true, else null>"}

Text:
${cleanedForClaude}`,
        userId: "automation",
        maxTokens: 500,
        temperature: 0.1,
      });
      detection = parseJsonResponse<typeof detection>(result.text);
    } catch (err) {
      console.warn(`${logPrefix} detection call failed for ${opportunityName}:`, err);
      return null;
    }

    if (!detection?.isFullTor) {
      console.log(`${logPrefix} not a full TOR for ${opportunityName}: ${detection?.reason ?? "(no reason)"}`);
      return null;
    }

    // 3. Build a readable plain-text representation of the body.
    const plainText = stripPreservingBreaks(body);
    if (!plainText) {
      console.warn(`${logPrefix} body stripped to empty for ${opportunityName}, skipping storage`);
      return null;
    }

    // 4. Upload to R2 under the campaigns/* prefix (token scope).
    let publicUrl: string;
    try {
      const key = `campaigns/rfp-tors/${rfpId}/${Date.now()}-inline.txt`;
      publicUrl = await uploadAsset(
        Buffer.from(plainText, "utf-8"),
        key,
        "text/plain; charset=utf-8",
      );
    } catch (err) {
      console.warn(`${logPrefix} R2 upload failed for ${opportunityName}:`, err);
      return null;
    }

    const snapshot =
      typeof detection.extractedSnapshot === "string" && detection.extractedSnapshot.trim()
        ? detection.extractedSnapshot.trim()
        : undefined;

    console.log(`${logPrefix} stored inline TOR for ${opportunityName} → ${publicUrl}`);
    return { torUrl: publicUrl, ...(snapshot && { requirementsSnapshot: snapshot }) };
  } catch (err) {
    // Outermost safety net — inline TOR detection must never block ingest.
    console.warn(`${logPrefix} unexpected error:`, err);
    return null;
  }
}

// ── main ingest function ──────────────────────────────────

export async function ingestOpportunity(input: IngestInput): Promise<IngestOutcome> {
  const { title, body, dedupKey, source = "Email Alert" } = input;
  // Unwrap Google redirect URLs (google.com/url?url=TARGET or ?q=TARGET) before
  // anything else — Feedly/RSS feeds often carry these verbatim from Google News.
  const url = sanitiseIngestUrl(input.url);

  // ── Deduplication ─────────────────────────────────────
  // Use dedupKey when provided (e.g. gmail:message:{id}), otherwise fall back to url.
  const deduplicateBy = dedupKey ?? url;
  if (deduplicateBy) {
    const { data: recent } = await queryRfpOpportunities(undefined, { pageSize: 100 });
    // Check against stored URL (canonical) and also dedupKey stored in URL field for
    // legacy records that still have gmail:message: pseudo-URLs.
    const duplicate = recent.find(
      (o) => o.url && (o.url === deduplicateBy || (url && o.url === url)),
    );
    if (duplicate) {
      return { created: false, skipped: "duplicate", existingId: duplicate.id };
    }
  }

  // ── AI triage ─────────────────────────────────────────
  const triage = await triageRfpOpportunity({ title, body, url, source });

  if (!triage.isOpportunity) {
    return { created: false, skipped: triage.skipReason ?? "not an opportunity", triage };
  }

  // ── Create in Notion ──────────────────────────────────
  const opp = await createRfpOpportunity({
    opportunityName: triage.opportunityName,
    status: "radar",
    opportunityType: triage.opportunityType,
    wvFitScore: triage.wvFitScore,
    serviceMatch: triage.serviceMatch,
    category: triage.category,
    geography: triage.geography,
    ...(triage.estimatedValue != null && { estimatedValue: triage.estimatedValue }),
    ...(triage.dueDate && { dueDate: { start: triage.dueDate, end: null } }),
    requirementsSnapshot: triage.requirementsSnapshot,
    decisionNotes: triage.decisionNotes,
    url: url ?? "",
    source,
  });

  // Track which TOR path (if any) set the document URL, for the outcome.
  let torStatus: TorStatus = "missing";
  let recordedTorUrl: string | undefined;

  // ── Inline TOR detection (body IS the TOR) ────────────
  // Runs BEFORE URL enrichment so a successfully-stored inline TOR can
  // short-circuit the remote fetch. Fail-open.
  const inlineTor = await detectAndStoreInlineTor({
    body,
    rfpId: opp.id,
    opportunityName: triage.opportunityName,
  });

  if (inlineTor) {
    try {
      // Only overwrite the snapshot if the triage one was sparse (<80 chars).
      const existingSnapshot = triage.requirementsSnapshot ?? "";
      const shouldReplaceSnapshot =
        !!inlineTor.requirementsSnapshot && existingSnapshot.length < 80;
      await updateRfpOpportunity(opp.id, {
        rfpDocumentUrl: inlineTor.torUrl,
        ...(shouldReplaceSnapshot && { requirementsSnapshot: inlineTor.requirementsSnapshot }),
      });
      torStatus = "inline";
      recordedTorUrl = inlineTor.torUrl;
    } catch (err) {
      // If the Notion update fails, we still stored the asset — log and fall through.
      console.warn("[rfp-ingest/inline-tor] Notion update failed:", err);
    }
  }

  // ── URL enrichment (best-effort, post-create) ─────────
  // If the URL is a real HTTP(S) link, scrape it to fill any gaps triage missed.
  if (url && url.startsWith("http")) {
    try {
      // Pass alreadyHasTorUrl so enrichFromUrl doesn't skip the page fetch when
      // triage produced a good snapshot — TOR doc discovery is independent of that guard.
      const alreadyHasTorUrl = !!opp.rfpDocumentUrl || torStatus === "inline";
      const enriched = await enrichFromUrl(url, triage.dueDate, triage.requirementsSnapshot, alreadyHasTorUrl);
      if (enriched.dueDate || enriched.requirementsSnapshot || enriched.torDocumentUrl) {
        await updateRfpOpportunity(opp.id, {
          ...(enriched.dueDate && { dueDate: { start: enriched.dueDate, end: null } }),
          ...(enriched.requirementsSnapshot && { requirementsSnapshot: enriched.requirementsSnapshot }),
          // Store the discovered TOR PDF URL as the rfpDocumentUrl (only if not already set)
          ...(!alreadyHasTorUrl && enriched.torDocumentUrl && {
            rfpDocumentUrl: enriched.torDocumentUrl,
          }),
        });
        if (!alreadyHasTorUrl && enriched.torDocumentUrl) {
          torStatus = "pdf";
          recordedTorUrl = enriched.torDocumentUrl;
        }
      }
    } catch {
      // Enrichment failure never blocks opportunity creation
    }
  }

  // If neither inline detection nor enrichment set a URL but the opp was
  // created with one already populated (e.g. future code path), surface it
  // as a "pdf" status — we don't have the R2-inline marker for any other path.
  if (torStatus === "missing" && opp.rfpDocumentUrl) {
    recordedTorUrl = opp.rfpDocumentUrl;
    torStatus = "pdf";
  }

  return {
    created: true,
    id: opp.id,
    fitScore: triage.wvFitScore,
    triage,
    url,
    torStatus,
    ...(recordedTorUrl && { torUrl: recordedTorUrl }),
  };
}

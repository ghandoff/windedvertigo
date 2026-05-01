/**
 * Minimal RSS/Atom feed parser — zero dependencies, works in edge runtime.
 *
 * Handles:
 *   - RSS 2.0  (<channel><item>...</item></channel>)
 *   - Atom 1.0 (<feed><entry>...</entry></feed>)
 *   - World Bank custom Atom (wb: namespace fields)
 *   - Google Alerts Atom
 */

export interface FeedItem {
  title: string;
  url: string;
  body: string;
  publishedAt?: string;
}

// helpers

function extractTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${escaped}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}[^>]+${attr}=["']([^"']+)["']`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function stripHtmlTags(html: string): string {
  return html
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

function parseRssItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1];
    const title = stripHtmlTags(extractTag(chunk, "title"));
    const url =
      extractTag(chunk, "link") ||
      extractAttr(chunk, "link", "href") ||
      extractTag(chunk, "guid");
    const body = stripHtmlTags(
      extractTag(chunk, "description") || extractTag(chunk, "content:encoded") || "",
    );
    const publishedAt = extractTag(chunk, "pubDate") || extractTag(chunk, "dc:date");
    if (title || url) items.push({ title, url, body, publishedAt });
  }
  return items;
}

function parseAtomEntries(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const chunk = m[1];
    const title = stripHtmlTags(extractTag(chunk, "title"));
    const url =
      extractAttr(chunk, "link", "href") ||
      extractTag(chunk, "id");
    const body = stripHtmlTags(
      extractTag(chunk, "content") ||
        extractTag(chunk, "summary") ||
        extractTag(chunk, "wb:procnotices.bid_description") ||
        extractTag(chunk, "wb:procnotices.project_name") ||
        "",
    );
    const publishedAt = extractTag(chunk, "published") || extractTag(chunk, "updated");
    if (title || url) items.push({ title, url, body, publishedAt });
  }
  return items;
}

export function parseFeed(xml: string): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml);
  const items = isAtom ? parseAtomEntries(xml) : parseRssItems(xml);
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

/** Fetch a feed URL and parse it. Returns empty array on network/parse failure. */
export async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "wv-port/1.0 RFP-Lighthouse (+https://port.windedvertigo.com)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml);
  } catch (err) {
    console.warn(`[rss-parser] fetch failed for ${url}:`, err);
    return [];
  }
}

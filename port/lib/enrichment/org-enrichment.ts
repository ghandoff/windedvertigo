/**
 * Org auto-enrichment — logo, description, LinkedIn URL.
 *
 * 3-source pipeline:
 *   1. Website: <meta> tags, og:image, JSON-LD Organization schema
 *   2. LinkedIn: Proxycurl (if PROXYCURL_API_KEY is set)
 *   3. Favicon/Clearbit: logo fallback
 *
 * Claude merges all available signals into the best possible description.
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import type { OrgEnrichmentExtracted, OrgEnrichmentResult } from "@/lib/ai/types";

// ── domain utilities ──────────────────────────────────────

function extractDomain(website: string): string {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

function guessDomainFromName(orgName: string): string {
  return orgName
    .toLowerCase()
    .replace(/\b(the|a|an|inc|llc|ltd|corp|foundation|institute|group|organization|centre|center|network|association)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim() + ".org";
}

// ── structured signals from website HTML ──────────────────

interface WebsiteSignals {
  metaDescription: string | null;
  ogImage: string | null;
  jsonLdDescription: string | null;
  jsonLdLogo: string | null;
  jsonLdLinkedin: string | null;
  bodyText: string;
}

function extractMetaContent(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m?.[1] ?? null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    // Handle both single object and @graph array
    const items: unknown[] = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
    return (items.find((i) => (i as Record<string, unknown>)["@type"] === "Organization") as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

function parseWebsiteSignals(html: string): WebsiteSignals {
  const metaDescription = extractMetaContent(html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,})/i
  ) ?? extractMetaContent(html,
    /<meta[^>]+content=["']([^"']{10,})["'][^>]+name=["']description["']/i
  );

  const ogImage = extractMetaContent(html,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i
  ) ?? extractMetaContent(html,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  );

  const jsonLd = extractJsonLd(html);
  const jsonLdDescription = typeof jsonLd?.description === "string" ? jsonLd.description : null;
  const jsonLdLogo = typeof jsonLd?.logo === "string" ? jsonLd.logo
    : typeof (jsonLd?.logo as Record<string, unknown>)?.url === "string"
      ? (jsonLd!.logo as Record<string, unknown>).url as string
      : null;

  let jsonLdLinkedin: string | null = null;
  const sameAs = jsonLd?.sameAs;
  if (typeof sameAs === "string" && sameAs.includes("linkedin.com")) {
    jsonLdLinkedin = sameAs;
  } else if (Array.isArray(sameAs)) {
    jsonLdLinkedin = sameAs.find((s: unknown) => typeof s === "string" && s.includes("linkedin.com")) ?? null;
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  return { metaDescription, ogImage, jsonLdDescription, jsonLdLogo, jsonLdLinkedin, bodyText };
}

async function fetchWebsiteSignals(website: string): Promise<WebsiteSignals> {
  const empty: WebsiteSignals = {
    metaDescription: null, ogImage: null,
    jsonLdDescription: null, jsonLdLogo: null, jsonLdLinkedin: null,
    bodyText: "",
  };
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; enrichment-bot/1.0)" },
    });
    if (!res.ok) return empty;
    return parseWebsiteSignals(await res.text());
  } catch {
    return empty;
  }
}

// ── LinkedIn via Proxycurl ────────────────────────────────

interface LinkedInSignals {
  description: string | null;
  logoUrl: string | null;
  linkedinUrl: string | null;
}

async function fetchLinkedInSignals(linkedinUrl: string): Promise<LinkedInSignals> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return { description: null, logoUrl: null, linkedinUrl: null };
  try {
    const res = await fetch(
      `https://nubela.co/proxycurl/api/linkedin/company?url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return { description: null, logoUrl: null, linkedinUrl };
    const data = await res.json();
    return {
      description: data.description ?? null,
      logoUrl: data.profile_pic_url ?? null,
      linkedinUrl,
    };
  } catch {
    return { description: null, logoUrl: null, linkedinUrl };
  }
}

// ── logo priority chain ───────────────────────────────────

async function resolveLogo(
  domain: string,
  ogImage: string | null,
  jsonLdLogo: string | null,
  linkedInLogo: string | null,
): Promise<string | null> {
  // Try og:image first (usually the canonical brand image)
  for (const candidate of [ogImage, jsonLdLogo, linkedInLogo]) {
    if (candidate && candidate.startsWith("http")) return candidate;
  }

  // Clearbit CDN
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  try {
    const res = await fetch(clearbitUrl, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    if (res.ok) return clearbitUrl;
  } catch { /* fall through */ }

  // Google favicon last resort
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// ── Claude extraction (merged sources) ───────────────────

async function extractWithClaude(
  orgName: string,
  website: WebsiteSignals,
  linkedin: LinkedInSignals,
  userId: string,
): Promise<{ extracted: OrgEnrichmentExtracted; usage: OrgEnrichmentResult["usage"] }> {
  const sections: string[] = [];

  if (website.metaDescription || website.jsonLdDescription) {
    sections.push(`## Website structured data\n${[website.jsonLdDescription, website.metaDescription].filter(Boolean).join("\n")}`);
  }
  if (website.bodyText) {
    sections.push(`## Website body text (truncated)\n${website.bodyText}`);
  }
  if (linkedin.description) {
    sections.push(`## LinkedIn company description\n${linkedin.description}`);
  }

  const hasAnything = sections.length > 0;

  const userMessage = `Extract information about the organisation "${orgName}".

${hasAnything ? sections.join("\n\n") : "(No source data available — use org name only.)"}

Return JSON with exactly these fields:
{
  "description": "1-2 sentence description of what the organisation does. If both website and LinkedIn data exist, synthesise the best version using whichever is more specific. Return null if genuinely unclear.",
  "linkedinUrl": "Full LinkedIn company URL (https://linkedin.com/company/...). Check website JSON-LD sameAs first, then LinkedIn source URL. Return null if not found.",
  "employeeSize": "One of: 1-10, 11-50, 51-200, 201-1000, 1000+ — or null.",
  "foundedYear": "Integer year or null."
}`;

  const result = await callClaude({
    feature: "org-enrichment",
    system: "You are a data extraction assistant. Extract structured information and return ONLY valid JSON with no explanation.",
    userMessage,
    userId,
    maxTokens: 512,
    temperature: 0.1,
  });

  let extracted: OrgEnrichmentExtracted = {
    description: null, linkedinUrl: null, employeeSize: null, foundedYear: null,
  };
  try {
    extracted = parseJsonResponse<OrgEnrichmentExtracted>(result.text);
    // Prefer LinkedIn URL from signals if Claude missed it
    if (!extracted.linkedinUrl) {
      extracted.linkedinUrl = website.jsonLdLinkedin ?? linkedin.linkedinUrl ?? null;
    }
  } catch { /* return nulls, enrichedAt still written */ }

  return {
    extracted,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd },
  };
}

// ── orchestrator ──────────────────────────────────────────

export async function enrichOrganization(
  orgId: string,
  orgName: string,
  website: string | undefined,
  userId: string,
  existingLinkedinUrl?: string,
): Promise<OrgEnrichmentResult> {
  const domain = website ? extractDomain(website) : guessDomainFromName(orgName);

  // Fetch website signals + any known LinkedIn URL in parallel
  const [websiteSignals] = await Promise.all([
    website ? fetchWebsiteSignals(website) : Promise.resolve<WebsiteSignals>({
      metaDescription: null, ogImage: null,
      jsonLdDescription: null, jsonLdLogo: null, jsonLdLinkedin: null,
      bodyText: "",
    }),
  ]);

  // Use LinkedIn URL from website JSON-LD first, then fall back to the stored value
  const linkedinUrlToFetch = websiteSignals.jsonLdLinkedin ?? existingLinkedinUrl ?? null;
  const linkedInSignals = linkedinUrlToFetch
    ? await fetchLinkedInSignals(linkedinUrlToFetch)
    : { description: null, logoUrl: null, linkedinUrl: null };

  const [logo, { extracted, usage }] = await Promise.all([
    resolveLogo(domain, websiteSignals.ogImage, websiteSignals.jsonLdLogo, linkedInSignals.logoUrl),
    extractWithClaude(orgName, websiteSignals, linkedInSignals, userId),
  ]);

  return { orgId, logo, extracted, usage };
}

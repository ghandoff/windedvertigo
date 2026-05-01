/**
 * Contact enrichment — profile photo + email address.
 *
 * Source priority:
 *
 * Photo:
 *   1. Proxycurl person API  (requires PROXYCURL_API_KEY)
 *   2. Gravatar by email MD5 (free, works for ~15–20% of business contacts)
 *
 * Email:
 *   1. Proxycurl person API  (returns personal_emails / work_email)
 *   2. Hunter.io email-finder (requires HUNTER_API_KEY — free tier: 25/mo)
 *
 * If PROXYCURL_API_KEY is set, one call covers both photo and email.
 */

import { createHash } from "crypto";

// ── Types ────────────────────────────────────────────────

export interface ContactEnrichResult {
  photoUrl: string | null;
  photoSource: "proxycurl" | "gravatar" | null;
  email: string | null;
  emailSource: "proxycurl" | "hunter" | null;
  emailConfidence: number | null; // 0–100, Hunter only
}

// ── Helpers ──────────────────────────────────────────────

function extractDomain(website: string): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

// ── Proxycurl person API ─────────────────────────────────

interface ProxycurlPerson {
  profile_pic_url?: string;
  personal_emails?: string[];
  work_email?: string;
}

async function fetchProxycurlPerson(linkedinUrl: string): Promise<ProxycurlPerson | null> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?linkedin_profile_url=${encodeURIComponent(linkedinUrl)}&personal_email=include&work_email=include&use_cache=if-present`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Gravatar ──────────────────────────────────────────────

async function fetchGravatarPhoto(email: string): Promise<string | null> {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  try {
    const res = await fetch(`https://www.gravatar.com/avatar/${hash}?s=200&d=404`, {
      method: "HEAD",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? `https://www.gravatar.com/avatar/${hash}?s=200` : null;
  } catch {
    return null;
  }
}

// ── Hunter.io email finder ────────────────────────────────

async function fetchHunterEmail(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<{ email: string; confidence: number } | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || !domain || !firstName) return null;
  try {
    const url = new URL("https://api.hunter.io/v2/email-finder");
    url.searchParams.set("domain", domain);
    url.searchParams.set("first_name", firstName);
    if (lastName) url.searchParams.set("last_name", lastName);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data?.email) return null;
    return { email: data.email, confidence: data.score ?? 0 };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────

export async function enrichContact(params: {
  name: string;
  email?: string;
  linkedinUrl?: string;
  orgWebsite?: string;
}): Promise<ContactEnrichResult> {
  const result: ContactEnrichResult = {
    photoUrl: null,
    photoSource: null,
    email: null,
    emailSource: null,
    emailConfidence: null,
  };

  // ── 1. Proxycurl (covers photo + email in one call) ────
  if (params.linkedinUrl && process.env.PROXYCURL_API_KEY) {
    const person = await fetchProxycurlPerson(params.linkedinUrl);
    if (person) {
      if (person.profile_pic_url) {
        result.photoUrl = person.profile_pic_url;
        result.photoSource = "proxycurl";
      }
      const foundEmail = person.work_email || person.personal_emails?.[0] || null;
      if (foundEmail) {
        result.email = foundEmail;
        result.emailSource = "proxycurl";
        result.emailConfidence = 100;
      }
    }
  }

  // ── 2. Gravatar fallback for photo ────────────────────
  if (!result.photoUrl && params.email) {
    const gravatarUrl = await fetchGravatarPhoto(params.email);
    if (gravatarUrl) {
      result.photoUrl = gravatarUrl;
      result.photoSource = "gravatar";
    }
  }

  // ── 3. Hunter.io fallback for email ───────────────────
  if (!result.email && params.orgWebsite) {
    const domain = extractDomain(params.orgWebsite);
    if (domain) {
      const { firstName, lastName } = splitName(params.name);
      const hunterResult = await fetchHunterEmail(firstName, lastName, domain);
      if (hunterResult) {
        result.email = hunterResult.email;
        result.emailSource = "hunter";
        result.emailConfidence = hunterResult.confidence;
      }
    }
  }

  return result;
}

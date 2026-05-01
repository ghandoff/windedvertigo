/**
 * Gmail REST API helper — reply detection + RFP inbox scanning.
 *
 * Main inbox (Garrett):  GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *
 * RFP scanning uses a Google service account with domain-wide delegation to
 * impersonate lamis@windedvertigo.com (who receives opportunities@windedvertigo.com
 * forwarded mail). This avoids polluting any personal inbox.
 *
 * Required env vars for RFP scanning:
 *   GOOGLE_SA_RFP_SCANNER — compact JSON of the service account key file
 *   RFP_GMAIL_USER        — Gmail userId to impersonate (default: lamis@windedvertigo.com)
 *
 * To set up domain-wide delegation for the service account:
 *   Google Workspace Admin → Security → API controls → Domain-wide delegation
 *   Add client ID 109146183570982842405 with scope:
 *   https://www.googleapis.com/auth/gmail.modify
 */

import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users";

/** Build the base URL for a given userId (defaults to "me"). */
function gmailBase(userId = "me"): string {
  return `${GMAIL_API}/${encodeURIComponent(userId)}`;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
}

/** Exchange a refresh token for a short-lived access token. */
async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token refresh failed: ${text}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/** Access token for the main Garrett inbox (GMAIL_REFRESH_TOKEN). */
export async function getGmailAccessToken(): Promise<string> {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Gmail credentials not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)");
  }
  return refreshAccessToken(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN);
}

/**
 * Access token for RFP inbox scanning via service account domain-wide delegation.
 * Impersonates RFP_GMAIL_USER (default: lamis@windedvertigo.com) so the scanner
 * can read the opportunities@ forwarded inbox without touching any personal inbox.
 *
 * Requires GOOGLE_SA_RFP_SCANNER env var (compact JSON of the service account key).
 * Falls back to Garrett's refresh token if the SA key is not configured.
 */
export async function getRfpGmailAccessToken(): Promise<string> {
  const saKeyJson = process.env.GOOGLE_SA_RFP_SCANNER;
  if (saKeyJson) {
    const subject = getRfpGmailUser();
    return getServiceAccountAccessToken(saKeyJson, subject);
  }
  // Fallback: Garrett's OAuth refresh token (works only if userId=me)
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("RFP Gmail credentials not configured (GOOGLE_SA_RFP_SCANNER or GMAIL_REFRESH_TOKEN)");
  }
  return refreshAccessToken(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN);
}

/**
 * Obtain a short-lived access token by signing a JWT as a service account
 * and requesting impersonation of `subject` via domain-wide delegation.
 */
async function getServiceAccountAccessToken(saKeyJson: string, subject: string): Promise<string> {
  const key = JSON.parse(saKeyJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    sub: subject,
    scope: "https://www.googleapis.com/auth/gmail.modify",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(key.private_key, "base64url");

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Service account token exchange failed: ${text}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/**
 * Search Gmail inbox for messages matching the query.
 * Returns up to maxResults message IDs.
 */
async function listMessages(
  query: string,
  accessToken: string,
  maxResults = 50,
  userId = "me",
): Promise<{ id: string; threadId: string }[]> {
  const url = `${gmailBase(userId)}/messages?${new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  })}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail list failed: ${text}`);
  }

  const data = await res.json() as { messages?: { id: string; threadId: string }[] };
  return data.messages ?? [];
}

/**
 * Fetch message headers (subject, from, date) for a single message.
 */
async function getMessage(
  messageId: string,
  accessToken: string,
  userId = "me",
): Promise<GmailMessage | null> {
  const url = `${gmailBase(userId)}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    id: string;
    threadId: string;
    payload: { headers: { name: string; value: string }[] };
  };

  const headers = data.payload?.headers ?? [];
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const subject = get("Subject");
  const from = get("From");
  const date = get("Date");

  if (!subject || !from) return null;

  return { id: data.id, threadId: data.threadId, subject, from, date };
}

/**
 * Strip reply prefixes from a subject line ("Re:", "RE:", nested "Re: Re:").
 * Returns the base subject.
 */
export function stripReplyPrefix(subject: string): string {
  return subject.replace(/^(re:\s*)+/i, "").trim();
}

/**
 * Extract email address from a From header like "Name <email@example.com>" or "email@example.com".
 */
export function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return fromHeader.toLowerCase().trim();
}

/**
 * Fetch all reply emails received in the past N days.
 * A "reply" is an inbox message whose subject starts with "Re:".
 */
export async function fetchRecentReplies(
  daysBack = 14,
  accessToken: string,
): Promise<GmailMessage[]> {
  const after = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);
  const query = `in:inbox subject:Re: after:${after}`;

  const ids = await listMessages(query, accessToken, 100, "me");
  if (ids.length === 0) return [];

  const messages = await Promise.all(
    ids.map((m) => getMessage(m.id, accessToken, "me")),
  );

  return messages.filter((m): m is GmailMessage => m !== null);
}

// ── RFP inbox scanning ────────────────────────────────────

export interface GmailMessageWithBody extends GmailMessage {
  body: string;
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
  headers?: { name: string; value: string }[];
}

/** Decode base64url to UTF-8 string. */
function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Recursively walk MIME parts to extract plain-text body.
 * Prefers text/plain; falls back to text/html.
 */
function extractBodyText(payload: GmailPayload): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    // First pass: look for text/plain leaf
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Second pass: recurse into nested multipart
    for (const part of payload.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }
  // Fallback: HTML body
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

/**
 * Fetch a single message with its full decoded body.
 */
export async function getMessageWithBody(
  messageId: string,
  accessToken: string,
  userId = "me",
): Promise<GmailMessageWithBody | null> {
  const url = `${gmailBase(userId)}/messages/${messageId}?format=full`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    id: string;
    threadId: string;
    payload: GmailPayload;
  };

  const headers = data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const subject = get("Subject");
  const from = get("From");
  const date = get("Date");
  const body = extractBodyText(data.payload ?? {});

  if (!subject) return null;

  return { id: data.id, threadId: data.threadId, subject, from, date, body };
}

/**
 * Remove the UNREAD label from a message (marks it as read).
 */
export async function markMessageRead(messageId: string, accessToken: string, userId = "me"): Promise<void> {
  await fetch(`${gmailBase(userId)}/messages/${messageId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

/**
 * The Gmail userId to use for RFP scanning.
 * opportunities@windedvertigo.com forwards to lamis@windedvertigo.com;
 * override via RFP_GMAIL_USER env var if the forwarding target changes.
 */
export function getRfpGmailUser(): string {
  return process.env.RFP_GMAIL_USER ?? "lamis@windedvertigo.com";
}

/**
 * Fetch unread messages sent to opportunities@windedvertigo.com (daily cron mode).
 * Uses `to:opportunities@windedvertigo.com is:unread` to only touch RFP emails.
 */
export async function fetchUnreadRfpEmails(
  accessToken: string,
  maxResults = 25,
): Promise<GmailMessageWithBody[]> {
  const userId = getRfpGmailUser();
  const ids = await listMessages("to:opportunities@windedvertigo.com is:unread", accessToken, maxResults, userId);
  if (ids.length === 0) return [];

  const messages = await Promise.all(
    ids.map((m) => getMessageWithBody(m.id, accessToken, userId)),
  );

  return messages.filter((m): m is GmailMessageWithBody => m !== null);
}

/**
 * Fetch ALL messages sent to opportunities@windedvertigo.com, paginating through
 * the full history. Used for one-time backfill only.
 *
 * Gmail's messages.list API returns up to 500 IDs per page with a nextPageToken
 * for subsequent pages. This function follows all pages before fetching bodies.
 */
export async function fetchAllRfpEmails(
  accessToken: string,
): Promise<GmailMessageWithBody[]> {
  const userId = getRfpGmailUser();
  const query = "to:opportunities@windedvertigo.com";
  const allIds: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;

  // Page through the full message ID list
  do {
    const params = new URLSearchParams({ q: query, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${gmailBase(userId)}/messages?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail list failed: ${text}`);
    }

    const data = await res.json() as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    };

    allIds.push(...(data.messages ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (allIds.length === 0) return [];

  // Fetch full message bodies — batch in groups of 20 to avoid overwhelming the API
  const results: GmailMessageWithBody[] = [];
  const BATCH = 20;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const messages = await Promise.all(
      batch.map((m) => getMessageWithBody(m.id, accessToken, userId)),
    );
    results.push(...messages.filter((m): m is GmailMessageWithBody => m !== null));
  }

  return results;
}

// ── Procurement URL extraction ────────────────────────────
// Shared by the Gmail scanner cron and the URL migration endpoint.

/** Domains/patterns that are never procurement sources. */
export const NOISE_PATTERNS: RegExp[] = [
  /gmail\.com/i,
  /googleusercontent\.com/i,
  /mailchimp\.com/i,
  /sendgrid\.net/i,
  /constantcontact\.com/i,
  /mailgun\.org/i,
  /unsubscribe/i,
  /optout/i,
  /click\.em\./i,
  /tracking\./i,
  /t\.co\//i,
  /bit\.ly\//i,
  /ow\.ly\//i,
  /links\./i,
  /r20\.rs6\.net/i,
];

/** Terms that strongly suggest a procurement source page. */
export const PROCUREMENT_SIGNALS: string[] = [
  "rfp", "rfq", "rfi", "tender", "bid", "solicitation", "procurement",
  "proposal", "grant", "contract", "opportunity", "award", "call-for",
  "callfor", "cfp", "eoi", "expression-of-interest",
];

/**
 * Unwrap a Google redirect URL (google.com/url?q=TARGET&...) to its real destination.
 * Google Alerts emails wrap all links in this format, so without unwrapping we
 * would discard them as noise and miss the actual procurement URLs.
 */
function unwrapGoogleRedirect(url: string): string {
  if (!url.includes("google.com/url")) return url;
  try {
    const parsed = new URL(url);
    // Google Alerts uses "url=" param; google.com/url tracking uses "q="
    const dest = parsed.searchParams.get("url") ?? parsed.searchParams.get("q");
    return dest && dest.startsWith("http") ? dest : url;
  } catch {
    return url;
  }
}

/**
 * Extract the most likely procurement URL from an email body (HTML or plain text).
 *
 * Extraction strategy:
 *   1. HTML href attributes — for HTML email bodies
 *   2. Bare https:// URLs in plain text — fallback for text/plain parts
 *
 * Both passes unwrap Google Alerts redirect URLs (google.com/url?q=TARGET)
 * before scoring and noise-filtering.
 * Returns null if no suitable link is found.
 */
export function extractProcurementUrl(body: string): string | null {
  const rawUrls: string[] = [];

  // Pass 1: HTML href attributes
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(body)) !== null) {
    const href = match[1].trim();
    if (href.startsWith("http")) rawUrls.push(href);
  }

  // Pass 2: Bare URLs in plain text (fallback when no hrefs found, e.g. Google Alerts text/plain)
  if (rawUrls.length === 0) {
    const plainPattern = /https?:\/\/[^\s"'<>\]\)]+/g;
    let plainMatch: RegExpExecArray | null;
    while ((plainMatch = plainPattern.exec(body)) !== null) {
      rawUrls.push(plainMatch[0].replace(/[.,;:!?]+$/, ""));
    }
  }

  if (rawUrls.length === 0) return null;

  // Unwrap Google redirect URLs, then filter noise and score
  const scored = rawUrls
    .map(unwrapGoogleRedirect)
    .filter((url) => url.startsWith("http") && !NOISE_PATTERNS.some((p) => p.test(url)))
    .map((url) => {
      const lower = url.toLowerCase();
      const score = PROCUREMENT_SIGNALS.reduce(
        (acc, term) => (lower.includes(term) ? acc + 1 : acc),
        0,
      );
      return { url, score };
    });

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

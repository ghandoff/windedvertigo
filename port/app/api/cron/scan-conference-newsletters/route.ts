/**
 * GET /api/cron/scan-conference-newsletters
 *
 * Daily scan of each w.v team member's Gmail inbox for newsletter
 * announcements from a curated allowlist of conference / association /
 * CFP-platform senders. Each match is run through `triageConference`
 * (Claude Haiku) and inserted into `crm_events` as a candidate with
 * `discovered_via='newsletter'` if it's a real conference and not a dup.
 *
 * Schedule: daily at 06:30 UTC (registered in lib/scheduled.ts CRON_TABLE
 * by the parent agent — do not modify scheduled.ts here).
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * ── PRIVACY CONTRACT ────────────────────────────────────────────────
 * This cron NEVER scans personal mail. The Gmail query is built
 * exclusively from the domain allowlist in
 * `lib/conferences/newsletter-senders.ts`. The cron route never accepts
 * free-form sender params or query overrides. The query is constructed
 * server-side, the route inputs cannot influence which messages are
 * fetched. To expand coverage, add a sender to the allowlist file — that
 * is the only knob.
 *
 * Required env vars:
 *   CRON_SECRET                — bearer auth for the cron endpoint
 *   GOOGLE_SA_RFP_SCANNER      — service account key JSON (compact). The
 *                                same SA used by rfp-gmail-scanner; must
 *                                have domain-wide delegation across the
 *                                windedvertigo.com workspace with scope
 *                                https://www.googleapis.com/auth/gmail.readonly
 *                                (or gmail.modify, which is a superset).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { createSign } from "crypto";
import {
  NEWSLETTER_SENDERS,
  buildGmailQuery,
  type NewsletterSender,
} from "@/lib/conferences/newsletter-senders";
import { triageConference } from "@/lib/ai/conference-triage";
import { findDuplicateConference } from "@/lib/conferences/dedup";
import { upsertEventToSupabase } from "@/lib/supabase/events";
import { postToSlack } from "@/lib/slack";

export const maxDuration = 300;

// ── team mailbox allowlist ────────────────────────────────
// Hardcoded — never sourced from request input.
const TEAM_EMAILS: readonly string[] = [
  "garrett@windedvertigo.com",
  "payton@windedvertigo.com",
  "lamis@windedvertigo.com",
  "maria@windedvertigo.com",
  "jamie@windedvertigo.com",
] as const;

// Loose pre-filter to skip obvious non-conference mail before paying for AI.
const SUBJECT_PREFILTER =
  /(?:call for|conference|summit|symposium|cfp|abstract|early bird|registration|deadline|sessions|speakers)/i;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users";

// ── auth ──────────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

/**
 * Mint a short-lived access token for the given Gmail user via the SA's
 * domain-wide-delegation grant. Inlined here (rather than reusing the
 * private helper in `lib/gmail.ts`) so we can impersonate any team
 * mailbox per iteration without modifying the shared gmail module.
 */
async function getAccessTokenFor(subject: string): Promise<string> {
  const saKeyJson = process.env.GOOGLE_SA_RFP_SCANNER;
  if (!saKeyJson) {
    throw new Error("GOOGLE_SA_RFP_SCANNER not configured");
  }
  const key = JSON.parse(saKeyJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    sub: subject,
    scope: "https://www.googleapis.com/auth/gmail.readonly",
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
    throw new Error(`token exchange failed for ${subject}: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── gmail fetch helpers ───────────────────────────────────

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

interface FetchedMessage {
  id: string;
  subject: string;
  from: string;
  body: string;
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(payload: GmailPart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64Url(p.body.data);
    }
    for (const p of payload.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function listMessageIds(
  query: string,
  accessToken: string,
  userId: string,
  maxResults = 50,
): Promise<string[]> {
  const url = `${GMAIL_API}/${encodeURIComponent(userId)}/messages?${new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  })}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail list failed for ${userId}: ${text}`);
  }
  const data = (await res.json()) as { messages?: { id: string }[] };
  return (data.messages ?? []).map((m) => m.id);
}

async function fetchMessage(
  id: string,
  accessToken: string,
  userId: string,
): Promise<FetchedMessage | null> {
  const url = `${GMAIL_API}/${encodeURIComponent(userId)}/messages/${id}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string; payload: GmailPart };
  const headers = data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const subject = get("Subject");
  const from = get("From");
  const body = extractBody(data.payload ?? {});
  if (!subject) return null;
  return { id: data.id, subject, from, body };
}

// Best-effort URL extraction from body (first plausible https link).
function extractFirstUrl(body: string): string | undefined {
  const m = body.match(/https?:\/\/[^\s"'<>\]\)]+/);
  if (!m) return undefined;
  return m[0].replace(/[.,;:!?]+$/, "");
}

function senderDomainOf(fromHeader: string): string | null {
  const m = fromHeader.match(/<([^>]+)>/);
  const addr = (m ? m[1] : fromHeader).toLowerCase().trim();
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  return addr.slice(at + 1).replace(/[>,\s].*$/, "");
}

function senderMatchesAllowlist(fromHeader: string): NewsletterSender | null {
  const domain = senderDomainOf(fromHeader);
  if (!domain) return null;
  // Allow exact match or subdomain (e.g. news.aera.net → aera.net)
  for (const s of NEWSLETTER_SENDERS) {
    if (domain === s.domain || domain.endsWith(`.${s.domain}`)) return s;
  }
  return null;
}

// ── per-mailbox processing ────────────────────────────────

interface MailboxResult {
  messagesProcessed: number;
  candidatesAdded: number;
  skipped: number;
  errors: number;
}

async function scanMailbox(
  email: string,
  query: string,
): Promise<{ result: MailboxResult; addedCandidates: { name: string; senderDomain: string }[]; perDomainCounts: Record<string, { messages: number; conferences: number }> }> {
  const result: MailboxResult = {
    messagesProcessed: 0,
    candidatesAdded: 0,
    skipped: 0,
    errors: 0,
  };
  const addedCandidates: { name: string; senderDomain: string }[] = [];
  const perDomainCounts: Record<string, { messages: number; conferences: number }> = {};

  const accessToken = await getAccessTokenFor(email);
  const ids = await listMessageIds(query, accessToken, email, 50);

  for (const id of ids) {
    result.messagesProcessed++;
    try {
      const msg = await fetchMessage(id, accessToken, email);
      if (!msg) {
        result.skipped++;
        continue;
      }

      // Confirm sender is on the allowlist (defense-in-depth — Gmail's
      // `from:` filter should already enforce this, but a strict check
      // here closes the loop in case of forwarded mail with a different
      // envelope sender).
      const sender = senderMatchesAllowlist(msg.from);
      if (!sender) {
        result.skipped++;
        continue;
      }

      const bucket = perDomainCounts[sender.domain] ?? { messages: 0, conferences: 0 };
      bucket.messages++;
      perDomainCounts[sender.domain] = bucket;

      // Cheap pre-filter: skip subjects with no conference-y keywords.
      const cleanSubject = msg.subject.trim();
      const cleanBody = stripHtml(msg.body);
      if (!SUBJECT_PREFILTER.test(cleanSubject)) {
        // For high-signal senders, we still proceed if body keyword density
        // is non-trivial; otherwise skip.
        const bodyHits = (cleanBody.match(SUBJECT_PREFILTER) || []).length;
        if (sender.signalStrength !== "high" || bodyHits < 2) {
          result.skipped++;
          continue;
        }
      }

      const url = extractFirstUrl(cleanBody);

      const triage = await triageConference({
        title: cleanSubject,
        body: cleanBody,
        url,
        discoveredVia: "newsletter",
      });

      if (!triage.isConference) {
        console.log(
          `[scan-conference-newsletters] skip ${email} / ${sender.domain} — not-a-conference: ${triage.skipReason ?? ""}`,
        );
        result.skipped++;
        continue;
      }

      const dedup = await findDuplicateConference({
        name: triage.conferenceName,
        url: triage.url || url,
      });
      if (dedup.isDuplicate) {
        console.log(
          `[scan-conference-newsletters] skip ${email} / ${sender.domain} — duplicate (${dedup.matchedOn}) → ${dedup.existingId}`,
        );
        result.skipped++;
        continue;
      }

      const newId = `disc_${crypto.randomUUID()}`;
      await upsertEventToSupabase(newId, {
        event: triage.conferenceName,
        type: triage.type,
        event_start: triage.eventDates?.start ?? null,
        event_end: triage.eventDates?.end ?? null,
        proposal_deadline:
          triage.deadlines.find((d) => d.kind === "cfp_close")?.date ?? null,
        location: triage.location,
        est_attendance: triage.estAttendance,
        registration_cost: triage.registrationCost,
        why_it_matters: triage.whyItMatters,
        url: triage.url || url || null,
        status: "candidate",
        lifecycle_state: "upcoming",
        fit_score: triage.fitScore,
        triage_notes: triage.decisionNotes,
        discovered_via: "newsletter",
        discovered_at: new Date().toISOString(),
        external_id: `gmail:${id}`,
        raw_payload_json: {
          triage,
          gmailMessageId: id,
          sender: msg.from,
          senderDomain: sender.domain,
          subject: cleanSubject,
          scannedFor: email,
        } as unknown,
        deadlines: triage.deadlines as unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Phase 16: kick off cover image generation in background (non-blocking).
      const coverUrl = `${process.env.PORT_URL ?? "https://port.windedvertigo.com"}/api/events/${newId}/cover`;
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) {
        after(
          fetch(coverUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${cronSecret}` },
          }).catch((err) =>
            console.warn("[scan-conference-newsletters] cover image kick-off failed:", err),
          ),
        );
      }

      result.candidatesAdded++;
      addedCandidates.push({ name: triage.conferenceName, senderDomain: sender.domain });
      bucket.conferences++;
    } catch (err) {
      result.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scan-conference-newsletters] message ${id} for ${email} failed:`, msg);
    }
  }

  return { result, addedCandidates, perDomainCounts };
}

// ── route handler ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = buildGmailQuery(NEWSLETTER_SENDERS, 1);
  if (!query) {
    return NextResponse.json({ error: "no senders configured" }, { status: 500 });
  }

  const byMailbox: Record<string, MailboxResult> = {};
  const errors: string[] = [];
  const allAdded: { name: string; senderDomain: string; mailbox: string }[] = [];

  let scannedMailboxes = 0;
  let messagesProcessed = 0;
  let candidatesAdded = 0;

  for (const email of TEAM_EMAILS) {
    try {
      const { result, addedCandidates, perDomainCounts } = await scanMailbox(email, query);
      byMailbox[email] = result;
      scannedMailboxes++;
      messagesProcessed += result.messagesProcessed;
      candidatesAdded += result.candidatesAdded;
      for (const c of addedCandidates) {
        allAdded.push({ ...c, mailbox: email });
      }

      // Audit log: one line per scan target × sender domain combination.
      for (const [domain, counts] of Object.entries(perDomainCounts)) {
        console.log(
          `[scan-conference-newsletters] scanned ${email} against ${domain} — ${counts.messages} messages, ${counts.conferences} conferences`,
        );
      }
      if (Object.keys(perDomainCounts).length === 0) {
        console.log(
          `[scan-conference-newsletters] scanned ${email} — 0 messages from any allowlisted sender`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Token-not-available or list-failure for this mailbox — log + continue.
      console.warn(`[scan-conference-newsletters] mailbox ${email} skipped: ${msg}`);
      errors.push(`${email}: ${msg}`);
      byMailbox[email] = {
        messagesProcessed: 0,
        candidatesAdded: 0,
        skipped: 0,
        errors: 1,
      };
    }
  }

  // Summary Slack ping — only when something landed.
  if (candidatesAdded > 0) {
    const domains = Array.from(new Set(allAdded.map((a) => a.senderDomain))).join(", ");
    await postToSlack(
      `newsletter scan found ${candidatesAdded} conference${candidatesAdded === 1 ? "" : "s"} from ${domains} — review at https://port.windedvertigo.com/events?status=candidate`,
    );
  }

  return NextResponse.json({
    ok: true,
    scannedMailboxes,
    messagesProcessed,
    candidatesAdded,
    byMailbox,
    errors,
  });
}

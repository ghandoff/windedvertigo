/**
 * Google Docs + Drive client for wv-port.
 *
 * Creates proposal and cover letter documents in a specific Google Drive folder
 * by uploading HTML to the Drive API which converts it to a native Google Doc.
 *
 * Auth mirrors gcal.ts — in priority order:
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON  — service account JSON (folder must be shared
 *      with the service account email address).
 *   2. GOOGLE_DOCS_REFRESH_TOKEN + GOOGLE_DOCS_CLIENT_ID + GOOGLE_DOCS_CLIENT_SECRET
 *      — OAuth refresh token with `drive.file` scope.
 *
 * Getting a refresh token (one-time, ~5 minutes):
 *   1. Go to https://developers.google.com/oauthplayground
 *   2. Click the gear icon (top-right) → "Use your own OAuth credentials"
 *      Enter your GOOGLE_DOCS_CLIENT_ID and GOOGLE_DOCS_CLIENT_SECRET
 *   3. In Step 1 (Select & authorize APIs), paste:
 *      https://www.googleapis.com/auth/drive.file
 *      and click Authorize APIs
 *   4. In Step 2, click "Exchange authorization code for tokens"
 *   5. Copy the refresh_token value
 *   6. Set it: printf '<token>' | npx wrangler secret put GOOGLE_DOCS_REFRESH_TOKEN --name wv-port-jobs
 *
 * Required secrets in wv-port-jobs:
 *   GOOGLE_DOCS_FOLDER_ID        — Drive folder ID (from the folder URL)
 *   GOOGLE_DOCS_REFRESH_TOKEN    — OAuth refresh token with drive.file scope
 *   GOOGLE_DOCS_CLIENT_ID        — OAuth client ID (can reuse Calendar app)
 *   GOOGLE_DOCS_CLIENT_SECRET    — OAuth client secret (can reuse Calendar app)
 *
 * All public functions return null and log a warning if credentials are absent,
 * so the pipeline can fall back gracefully without crashing.
 */

import { createSign } from "crypto";
import type { ProposalDraft } from "@/lib/ai/proposal-generator";

const TOKEN_URL    = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const GDOCS_SCOPE  = "https://www.googleapis.com/auth/drive.file";

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getTokenViaRefresh(): Promise<string | null> {
  const {
    GOOGLE_DOCS_REFRESH_TOKEN,
    GOOGLE_DOCS_CLIENT_ID,
    GOOGLE_DOCS_CLIENT_SECRET,
  } = process.env;

  if (!GOOGLE_DOCS_REFRESH_TOKEN || !GOOGLE_DOCS_CLIENT_ID || !GOOGLE_DOCS_CLIENT_SECRET) {
    return null;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     GOOGLE_DOCS_CLIENT_ID,
      client_secret: GOOGLE_DOCS_CLIENT_SECRET,
      refresh_token: GOOGLE_DOCS_REFRESH_TOKEN,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    console.warn("[gdocs] OAuth token refresh failed:", await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function getTokenViaServiceAccount(saKeyJson: string): Promise<string | null> {
  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(saKeyJson) as { client_email: string; private_key: string };
  } catch {
    console.warn("[gdocs] failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  const now  = Math.floor(Date.now() / 1000);
  const hdr  = { alg: "RS256", typ: "JWT" };
  const pay  = {
    iss: key.client_email,
    scope: GDOCS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const b64url      = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64url(hdr)}.${b64url(pay)}`;
  const signer       = createSign("RSA-SHA256");
  signer.update(signingInput);
  const jwt = `${signingInput}.${signer.sign(key.private_key, "base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!res.ok) {
    console.warn("[gdocs] service account token exchange failed:", await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function getAccessToken(): Promise<string | null> {
  const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saKeyJson) return getTokenViaServiceAccount(saKeyJson);
  return getTokenViaRefresh();
}

// ── Drive API ─────────────────────────────────────────────────────────────────

async function uploadHtmlAsGoogleDoc(
  name: string,
  htmlContent: string,
  folderId: string,
  accessToken: string,
): Promise<{ id: string }> {
  const boundary = `wv_gdoc_${Date.now()}`;
  const metadata = JSON.stringify({
    name,
    mimeType: "application/vnd.google-apps.document",
    parents:  [folderId],
  });

  // Multipart body: metadata part + HTML content part
  // Drive converts the HTML to a native Google Doc on ingest.
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlContent,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "<no body>");
    throw new Error(`[gdocs] Drive upload failed (${res.status}): ${txt.slice(0, 500)}`);
  }

  return res.json() as Promise<{ id: string }>;
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convert a multi-paragraph prose string into <p> tags. */
function paragraphs(text: string): string {
  if (!text?.trim()) return "";
  return text
    .split(/\n{2,}/)
    .map((chunk) => {
      const t = chunk.trim();
      if (!t) return "";
      // Preserve visual aide callouts as italicised notes
      if (t.startsWith("🎨 Visual aide:")) return `<p><em>${esc(t)}</em></p>`;
      return `<p>${esc(t).replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildProposalHtml(
  draft: ProposalDraft,
  rfpName: string,
  orgName: string | null,
  dueDate: string | null,
  valueLabel: string | null,
  teamBios: Record<string, string>,
): string {
  const parts: string[] = [
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>`,
    `<h1>${esc(rfpName)}</h1>`,
  ];

  // Metadata line
  const meta = [
    orgName    ? `Client: ${esc(orgName)}`      : null,
    dueDate    ? `Due: ${esc(dueDate)}`          : null,
    valueLabel ? `Value: ${esc(valueLabel)}`     : null,
  ].filter(Boolean);
  if (meta.length) parts.push(`<p><em>${meta.join(" · ")}</em></p>`);
  parts.push("<hr>");

  // Main proposal sections
  parts.push(`<h2>Executive Summary</h2>`);
  parts.push(paragraphs(draft.executiveSummary));

  parts.push(`<h2>Understanding of Requirements</h2>`);
  parts.push(paragraphs(draft.understandingOfRequirements));

  parts.push(`<h2>Proposed Approach</h2>`);
  parts.push(paragraphs(draft.proposedApproach));

  parts.push(`<h2>Relevant Experience</h2>`);
  for (const exp of draft.relevantExperience) {
    parts.push(`<h3>${esc(exp.project)}</h3>`);
    parts.push(paragraphs(exp.relevance));
  }

  parts.push(`<h2>Team Composition</h2>`);
  parts.push(paragraphs(draft.teamComposition));

  parts.push(`<h2>Value Proposition</h2>`);
  parts.push(paragraphs(draft.valueProposition));

  parts.push(`<h2>Budget Framework</h2>`);
  parts.push(paragraphs(draft.budgetFramework));

  parts.push(`<h2>Risk Mitigation</h2>`);
  parts.push(paragraphs(draft.riskMitigation));

  // Clarifying questions
  if (draft.clarifyingQuestions.length > 0) {
    parts.push(`<h2>Clarifying Questions for Client</h2>`);
    parts.push(`<ul>${draft.clarifyingQuestions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`);
  }

  // Gaps to fill
  if (draft.missingInfo.length > 0) {
    parts.push(`<h2>Gaps to Fill Before Submitting</h2>`);
    parts.push(`<ul>${draft.missingInfo.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`);
  }

  // References
  if (draft.references.length > 0) {
    parts.push(`<h2>References</h2>`);
    parts.push(`<ul>${draft.references.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`);
  }

  // Team CVs — appended to the proposal doc (not a separate file, per the
  // "two docs per RFP" requirement: main proposal + cover letter)
  if (draft.teamMembersForCvs.length > 0) {
    parts.push(`<h2>Team CVs</h2>`);
    for (const name of draft.teamMembersForCvs) {
      const bio = teamBios[name];
      if (!bio) continue;
      parts.push(`<h3>${esc(name)}</h3>`);
      parts.push(paragraphs(bio));
    }
  }

  parts.push(`</body></html>`);
  return parts.filter(Boolean).join("\n");
}

function buildCoverLetterHtml(text: string, rfpName: string): string {
  return [
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>`,
    `<h1>Cover Letter — ${esc(rfpName)}</h1>`,
    paragraphs(text),
    `</body></html>`,
  ].join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GDocResult {
  /** Google Doc file ID */
  id: string;
  /** Direct edit URL — https://docs.google.com/document/d/<id>/edit */
  url: string;
}

/**
 * Create the main proposal Google Doc in the configured Drive folder.
 *
 * Returns null (and logs a warning) when:
 *   - GOOGLE_DOCS_FOLDER_ID is not set
 *   - Google auth credentials are missing or invalid
 *
 * Throws on Drive API errors so the caller can surface them in Slack.
 *
 * @param teamBios  Pass TEAM_BIOS from @/lib/ai/proposal-generator
 */
export async function createProposalGoogleDoc(
  rfpName:    string,
  draft:      ProposalDraft,
  orgName:    string | null,
  dueDate:    string | null,
  valueLabel: string | null,
  teamBios:   Record<string, string>,
): Promise<GDocResult | null> {
  const folderId = process.env.GOOGLE_DOCS_FOLDER_ID;
  if (!folderId) {
    console.warn("[gdocs] GOOGLE_DOCS_FOLDER_ID not set — skipping Google Doc creation");
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn(
      "[gdocs] no Google credentials configured " +
      "(GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DOCS_REFRESH_TOKEN) — skipping proposal doc",
    );
    return null;
  }

  const html = buildProposalHtml(draft, rfpName, orgName, dueDate, valueLabel, teamBios);
  const { id } = await uploadHtmlAsGoogleDoc(
    `Proposal — ${rfpName}`,
    html,
    folderId,
    accessToken,
  );

  return { id, url: `https://docs.google.com/document/d/${id}/edit` };
}

/**
 * Create the cover letter Google Doc in the configured Drive folder.
 *
 * Returns null when credentials are absent. Throws on Drive API errors.
 */
export async function createCoverLetterGoogleDoc(
  rfpName:         string,
  coverLetterText: string,
): Promise<GDocResult | null> {
  const folderId = process.env.GOOGLE_DOCS_FOLDER_ID;
  if (!folderId) {
    console.warn("[gdocs] GOOGLE_DOCS_FOLDER_ID not set — skipping cover letter Google Doc");
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn("[gdocs] no Google credentials — skipping cover letter doc");
    return null;
  }

  const html = buildCoverLetterHtml(coverLetterText, rfpName);
  const { id } = await uploadHtmlAsGoogleDoc(
    `Cover Letter — ${rfpName}`,
    html,
    folderId,
    accessToken,
  );

  return { id, url: `https://docs.google.com/document/d/${id}/edit` };
}

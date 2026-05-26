/**
 * Shared Google service-account JWT token minter.
 *
 * Mints OAuth2 access tokens using the same Service Account that powers
 * gcal-sync, with Domain-Wide Delegation when GOOGLE_IMPERSONATE_SUBJECT is
 * set. Both lib/gcal.ts and lib/gdrive.ts call this so we don't duplicate
 * the JWT signing logic.
 *
 * Auth priority:
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON  — service account key (preferred path).
 *      Calendar/Drive scopes must be authorized for the SA's Client ID in
 *      Workspace Admin → Security → API controls → Domain-wide delegation.
 *   2. (No fallback here — gcal.ts has its own legacy OAuth-refresh path
 *      for backward compat. New callers should go SA-only.)
 *
 * Per-token-cache: tokens are valid for 3600s; we don't bother caching for
 * now since CF Workers instances are short-lived and the marginal cost of
 * minting a token (~1 RTT to oauth2.googleapis.com) is fine.
 */

import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/**
 * Mint an access token for the given OAuth scope.
 *
 * `scope` can be a single scope string or a space-separated list. With DWD
 * authorization, the SA can request any subset of authorized scopes in one
 * token — useful when a single caller needs both Calendar + Drive.
 *
 * `subject` overrides the default impersonation subject (env-driven). Used
 * by multi-member crons that iterate over a list of team email addresses,
 * minting a token AS each member in turn. Pass undefined/omit to use the
 * env-default (GOOGLE_IMPERSONATE_SUBJECT) — backward-compatible.
 *
 * Returns null on any failure (parse, signing, HTTP). Logs to console.warn.
 * Callers should treat null as "fall through to next strategy" or fail-open.
 */
export async function mintSaAccessToken(
  scope: string,
  subject?: string,
): Promise<string | null> {
  const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saKeyJson) return null;

  let key: ServiceAccountKey;
  try {
    key = JSON.parse(saKeyJson) as ServiceAccountKey;
  } catch {
    console.warn("[google-sa] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const impersonate = subject ?? process.env.GOOGLE_IMPERSONATE_SUBJECT;
  const payload: Record<string, unknown> = {
    iss: key.client_email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  if (impersonate) payload.sub = impersonate;

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
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
    console.warn(`[google-sa] token exchange failed (scope=${scope}):`, text.slice(0, 300));
    return null;
  }

  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

// Common scope constants — central source of truth, also doubles as a
// reminder for what DWD needs to be authorized for in Workspace Admin.
export const SCOPES = {
  calendar:      "https://www.googleapis.com/auth/calendar",
  driveReadonly: "https://www.googleapis.com/auth/drive.readonly",
  gmail:         "https://www.googleapis.com/auth/gmail.readonly",
} as const;

/**
 * Resolve the team email list used by multi-member crons (gcal-sync,
 * meet-transcript-ingest). Reads from GOOGLE_IMPERSONATE_SUBJECTS (comma-
 * separated). Falls back to GOOGLE_IMPERSONATE_SUBJECT (single value) when
 * the multi-value var is unset — preserves backward compat with single-user
 * deploys.
 *
 * Returns deduplicated, lowercased, trimmed emails. Empty array on no config.
 */
export function listImpersonationSubjects(): string[] {
  const multi = process.env.GOOGLE_IMPERSONATE_SUBJECTS;
  if (multi) {
    const out = multi
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(out));
  }
  const single = process.env.GOOGLE_IMPERSONATE_SUBJECT;
  return single ? [single.trim().toLowerCase()] : [];
}

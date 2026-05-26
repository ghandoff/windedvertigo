/**
 * Google Drive read helpers — list folder contents + export Google Docs
 * to plain text. Used by the Meet AI transcript ingest cron.
 *
 * Auth: SA + Domain-Wide Delegation via lib/shared/google-sa.ts. Requires
 * the SA's Client ID to have `https://www.googleapis.com/auth/drive.readonly`
 * authorized in Workspace Admin → API controls → Domain-wide delegation.
 *
 * Distinct from lib/gdocs.ts (which uses GOOGLE_DOCS_* env vars + the
 * narrower drive.file scope, scoped to docs the app itself created — not
 * useful for reading Meet-generated transcripts).
 */

import { mintSaAccessToken, SCOPES } from "./shared/google-sa";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  webViewLink?: string;
  /** Set on Meet AI transcript docs — links back to the calendar event. */
  properties?: Record<string, string>;
}

/**
 * List files in a Drive folder modified since `modifiedSinceIso`, sorted
 * newest-first. Optional `nameContains` filter narrows to transcript-shaped
 * filenames. Returns up to `limit` entries.
 *
 * Returns null on auth failure (treat as "skip this run"). Returns empty
 * array on "no matches", which is a normal state.
 */
export async function listFilesInFolder(
  folderId: string,
  opts: {
    modifiedSinceIso?: string;
    nameContains?: string;
    limit?: number;
    /** Impersonate a specific Workspace user (multi-member ingest). */
    subject?: string;
  } = {},
): Promise<DriveFile[] | null> {
  const token = await mintSaAccessToken(SCOPES.driveReadonly, opts.subject);
  if (!token) {
    console.warn("[gdrive] no SA access token (scope=drive.readonly)");
    return null;
  }

  // Drive's `q` param uses a SQL-like syntax. Quote folder id + escape
  // single quotes in name filters defensively.
  const clauses: string[] = [
    `'${folderId}' in parents`,
    `trashed = false`,
  ];
  if (opts.modifiedSinceIso) {
    clauses.push(`modifiedTime > '${opts.modifiedSinceIso}'`);
  }
  if (opts.nameContains) {
    const safe = opts.nameContains.replace(/'/g, "\\'");
    clauses.push(`name contains '${safe}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    orderBy: "modifiedTime desc",
    pageSize: String(opts.limit ?? 50),
    fields:
      "files(id,name,mimeType,modifiedTime,createdTime,webViewLink,properties)",
    // Required for service-account-as-user calls against personal Drives.
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[gdrive] list failed (${res.status}):`, txt.slice(0, 400));
    return null;
  }

  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

/**
 * Export a Google Doc as plain text. Returns null on failure (auth, 404,
 * non-Doc mime type). Meet AI transcripts are always Google Docs so the
 * export-to-text path works for them.
 */
export async function exportDocAsText(
  docId: string,
  opts: { subject?: string } = {},
): Promise<string | null> {
  const token = await mintSaAccessToken(SCOPES.driveReadonly, opts.subject);
  if (!token) return null;

  const params = new URLSearchParams({ mimeType: "text/plain" });
  const res = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(docId)}/export?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[gdrive] export ${docId} failed (${res.status}):`, txt.slice(0, 400));
    return null;
  }

  return await res.text();
}

/**
 * Find a Drive folder by name (used as a fallback when the user hasn't
 * configured an explicit MEET_TRANSCRIPTS_FOLDER_ID). Returns the first
 * matching folder's id or null. Limited utility — exact-match only.
 */
export async function findFolderByName(
  name: string,
  opts: { subject?: string } = {},
): Promise<string | null> {
  const token = await mintSaAccessToken(SCOPES.driveReadonly, opts.subject);
  if (!token) return null;

  const safe = name.replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name = '${safe}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    pageSize: "5",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

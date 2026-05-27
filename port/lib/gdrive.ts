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
 * Paginates via Drive's `nextPageToken` so backfills covering a year+ of
 * transcripts return all matching files, not just the first page. Each
 * Drive API call fetches up to 1000 files; we loop until either the
 * response has no `nextPageToken` or we've collected `limit` files.
 *
 * Returns null on auth failure (treat as "skip this run"). Returns empty
 * array on "no matches", which is a normal state.
 */
export async function listFilesInFolder(
  folderId: string,
  opts: {
    modifiedSinceIso?: string;
    nameContains?: string;
    /**
     * Hard cap on total files returned across all pages. Defaults to 50 to
     * keep the historical hourly-cron behavior unchanged. Backfill callers
     * pass much larger numbers (500+) along with a wider modifiedSinceIso.
     */
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

  const limit = opts.limit ?? 50;

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

  // Use Drive's max pageSize (1000) per request — fewer round-trips when
  // backfilling. Cap each loop iteration by what's still needed to honor
  // the caller's `limit`. Reset to 1000 if `limit` is huge.
  const baseParams = {
    q: clauses.join(" and "),
    orderBy: "modifiedTime desc",
    // `nextPageToken` MUST be requested explicitly in fields, otherwise the
    // server silently omits it and pagination breaks.
    fields:
      "nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,webViewLink,properties)",
    // Required for service-account-as-user calls against personal Drives.
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  };

  const collected: DriveFile[] = [];
  let pageToken: string | undefined = undefined;

  // Safety cap — prevents infinite loops if Drive misbehaves with a
  // permanent nextPageToken. 50 pages × 1000 = 50k files — more than any
  // realistic Meet Recordings folder.
  for (let page = 0; page < 50; page++) {
    const remaining = limit - collected.length;
    if (remaining <= 0) break;

    const params = new URLSearchParams({
      ...baseParams,
      pageSize: String(Math.min(1000, remaining)),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[gdrive] list failed (${res.status}):`, txt.slice(0, 400));
      // Return what we've collected so far if we already got at least one
      // page, otherwise null. Partial results > total failure for backfills.
      return collected.length > 0 ? collected : null;
    }

    const data = (await res.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
    };
    if (data.files) collected.push(...data.files);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  // Slice to the caller's limit — paranoid trim in case Drive returned
  // slightly more on the final page than we requested.
  return collected.slice(0, limit);
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

/**
 * GET /api/admin/meet-folder-find — diagnostic endpoint, finds where Meet AI
 * writes transcripts in the impersonated user's Drive.
 *
 * Searches for Google Docs whose name suggests a Meet AI transcript ("Notes
 * by Gemini" / "Transcript" / "Meeting recap"), returns each match's parent
 * folder. The user picks the right folder id from the list and sets it as
 * MEET_TRANSCRIPTS_FOLDER_ID on the worker.
 *
 * One-shot diagnostic — auth via Bearer CRON_SECRET so we can hit it from
 * the terminal without a browser session. Safe to leave in place; doesn't
 * write anything.
 */

import { NextRequest, NextResponse } from "next/server";
import { mintSaAccessToken, SCOPES } from "@/lib/shared/google-sa";

export const maxDuration = 60;

const DRIVE_API = "https://www.googleapis.com/drive/v3";

interface DriveSearchResult {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
}

interface FolderMeta {
  id: string;
  name: string;
}

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await mintSaAccessToken(SCOPES.driveReadonly);
  if (!token) {
    return NextResponse.json(
      {
        error: "no_drive_token",
        message:
          "SA failed to mint a Drive token. Check that drive.readonly is authorized in Workspace Admin → API controls → Domain-wide delegation for Client ID 112925595757118419088.",
      },
      { status: 503 },
    );
  }

  // Search for Meet AI transcript-shaped Docs modified in the last 60 days.
  // The `q` filter accepts OR clauses inside parens.
  const params = new URLSearchParams({
    q:
      "(name contains 'Notes by Gemini' or name contains 'Transcript' or name contains 'Meet ' or name contains 'Gemini') " +
      "and mimeType = 'application/vnd.google-apps.document' " +
      "and trashed = false " +
      `and modifiedTime > '${new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()}'`,
    orderBy: "modifiedTime desc",
    pageSize: "50",
    fields: "files(id,name,mimeType,modifiedTime,parents)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json(
      {
        error: "drive_search_failed",
        status: res.status,
        body: txt.slice(0, 600),
      },
      { status: 500 },
    );
  }

  const data = (await res.json()) as { files?: DriveSearchResult[] };
  const files = data.files ?? [];

  // Tally by parent folder id; we want the most common parent of matched
  // files (that's likely where Meet stores transcripts).
  const folderCounts: Record<string, { count: number; sampleFile: string }> = {};
  for (const f of files) {
    for (const parentId of f.parents ?? []) {
      if (!folderCounts[parentId]) {
        folderCounts[parentId] = { count: 0, sampleFile: f.name };
      }
      folderCounts[parentId].count++;
    }
  }

  // Look up folder names so the report is human-readable.
  const folderIds = Object.keys(folderCounts);
  const folderNames = new Map<string, string>();
  for (const fid of folderIds) {
    const fres = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fid)}?fields=id,name&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (fres.ok) {
      const meta = (await fres.json()) as FolderMeta;
      folderNames.set(fid, meta.name);
    }
  }

  const candidates = folderIds
    .map((fid) => ({
      folderId: fid,
      folderName: folderNames.get(fid) ?? "(unknown)",
      docCount: folderCounts[fid].count,
      sampleFile: folderCounts[fid].sampleFile,
    }))
    .sort((a, b) => b.docCount - a.docCount);

  return NextResponse.json({
    impersonating: process.env.GOOGLE_IMPERSONATE_SUBJECT ?? "(none)",
    totalDocsFound: files.length,
    sampleFiles: files.slice(0, 8).map((f) => ({ name: f.name, modifiedTime: f.modifiedTime })),
    folderCandidates: candidates,
    instructions:
      candidates.length > 0
        ? `Pick the folder with the highest docCount that looks right. Set MEET_TRANSCRIPTS_FOLDER_ID to its folderId via 'wrangler secret put'.`
        : "No Meet-shaped docs found in the last 60 days. Either there are no Meet AI transcripts yet, or the scope grant hasn't propagated. Wait 5 min and re-probe, or run a Meet AI session and re-probe.",
  });
}

/**
 * Google Drive REST API helper — upload files to a specific folder.
 *
 * Uses the same service account as the Gmail scanner (GOOGLE_SA_RFP_SCANNER)
 * with domain-wide delegation to impersonate garrett@windedvertigo.com.
 *
 * Prerequisite (one-time):
 *   Google Workspace Admin → Security → API controls → Domain-wide delegation
 *   Add scope https://www.googleapis.com/auth/drive to client 109146183570982842405
 *
 * Required env var:
 *   GOOGLE_DRIVE_INVOICE_FOLDER_ID — Google Drive folder ID for contractor invoices
 *   (GOOGLE_SA_RFP_SCANNER is shared with Gmail scanning)
 */

import { getServiceAccountAccessToken } from "./gmail";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_IMPERSONATE = "garrett@windedvertigo.com";

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

export async function getDriveToken(saKeyJson: string): Promise<string> {
  return getServiceAccountAccessToken(saKeyJson, DRIVE_IMPERSONATE, DRIVE_SCOPE);
}

/**
 * Upload a file to a Google Drive folder via multipart upload.
 * Works for files up to 5 MB (all invoice PDFs qualify).
 */
export async function uploadFileToDrive(
  filename: string,
  bytes: Buffer,
  mimeType: string,
  folderId: string,
  token: string,
): Promise<DriveFile> {
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const boundary = "fin_upload_boundary";

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    "", // body bytes appended below as binary
  ].join("\r\n");

  const bodyBuffer = Buffer.concat([
    Buffer.from(body, "utf-8"),
    bytes,
    Buffer.from(`\r\n--${boundary}--`, "utf-8"),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(bodyBuffer.length),
      },
      body: bodyBuffer,
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${err.slice(0, 300)}`);
  }

  return (await res.json()) as DriveFile;
}

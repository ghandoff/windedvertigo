/**
 * One-time admin endpoint: backfill contractor invoices from Box → Google Drive.
 *
 * Browses the Box root folder to auto-discover contractor subfolders by name,
 * finds each person's "Invoices" subfolder, downloads every PDF, uploads to
 * Google Drive (GOOGLE_DRIVE_INVOICE_FOLDER_ID), and creates fin_items.
 *
 * Target contractors (case-insensitive name match on Box folder names):
 *   - Maria Altamirano Gonzalez
 *   - Payton Jaeger
 *   - Apoorva
 *   - Aaron / Fruits and Voices
 *
 * Auth: Bearer CMO_API_TOKEN or CRON_SECRET
 * Required secrets: BOX_DEV_TOKEN, GOOGLE_DRIVE_INVOICE_FOLDER_ID, GOOGLE_SA_RFP_SCANNER
 *
 * Trigger (after renewing BOX_DEV_TOKEN):
 *   curl -H "Authorization: Bearer <CMO_API_TOKEN>" \
 *        https://port.windedvertigo.com/api/admin/box-drive-backfill
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getDriveToken, uploadFileToDrive } from "@/lib/drive";
import { createFinItem } from "@/lib/fin-data";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 300;

const BOX_API = "https://api.box.com/2.0";
const BOX_ROOT = "0";

// Name fragments to match against Box folder names (lowercase)
const TARGET_CONTRACTORS = [
  { match: ["maria", "altamirano"], label: "Maria Altamirano Gonzalez" },
  { match: ["payton", "jaeger"], label: "Payton Jaeger" },
  { match: ["apoorva"], label: "Apoorva" },
  { match: ["aaron"], label: "Aaron" },
  { match: ["fruits", "voices"], label: "Fruits and Voices" },
];

interface BoxEntry {
  type: string;
  id: string;
  name: string;
  modified_at?: string;
}

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

async function boxGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${BOX_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Box ${path}: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function listFolder(folderId: string, token: string): Promise<BoxEntry[]> {
  const data = (await boxGet(
    `/folders/${folderId}/items?fields=id,name,type,modified_at&limit=200`,
    token,
  )) as { entries: BoxEntry[] };
  return data.entries ?? [];
}

async function downloadBoxFile(fileId: string, token: string): Promise<Buffer | null> {
  // Box returns a 302 redirect to the actual download URL
  const res = await fetch(`${BOX_API}/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function getCapturedBoxIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("fin_items")
    .select("raw_email_id")
    .eq("source", "box")
    .not("raw_email_id", "is", null);
  return new Set((data ?? []).map((r) => r.raw_email_id as string));
}

function matchesContractor(folderName: string, terms: string[]): boolean {
  const lower = folderName.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const boxToken = process.env.BOX_DEV_TOKEN;
  if (!boxToken) return error("BOX_DEV_TOKEN not set — renew it first", 503);

  const folderId = process.env.GOOGLE_DRIVE_INVOICE_FOLDER_ID;
  if (!folderId) return error("GOOGLE_DRIVE_INVOICE_FOLDER_ID not set", 503);

  const saKey = process.env.GOOGLE_SA_RFP_SCANNER ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saKey) return error("GOOGLE_SA_RFP_SCANNER not set", 503);

  const result: {
    discovered_contractors: string[];
    pdfs_found: number;
    already_captured: number;
    uploaded: number;
    fin_items_created: number;
    items: string[];
    errors: string[];
  } = {
    discovered_contractors: [],
    pdfs_found: 0,
    already_captured: 0,
    uploaded: 0,
    fin_items_created: 0,
    items: [],
    errors: [],
  };

  // Step 1: list Box root to find contractor top-level folders
  let rootEntries: BoxEntry[] = [];
  try {
    rootEntries = await listFolder(BOX_ROOT, boxToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Box root listing failed: ${msg}`);
    if (msg.includes("401")) result.errors.push("BOX_DEV_TOKEN expired — renew at box.com/developers/console");
    return json({ ...result, ok: false });
  }

  const captured = await getCapturedBoxIds();
  let driveToken: string;
  try {
    driveToken = await getDriveToken(saKey);
  } catch (err) {
    result.errors.push(`Drive token error: ${err instanceof Error ? err.message : String(err)}`);
    return json({ ...result, ok: false });
  }

  // Step 2: for each top-level folder, check if it matches a target contractor
  for (const entry of rootEntries) {
    if (entry.type !== "folder") continue;

    const contractor = TARGET_CONTRACTORS.find((c) =>
      matchesContractor(entry.name, c.match),
    );
    if (!contractor) continue;

    result.discovered_contractors.push(`${entry.name} (${entry.id}) → ${contractor.label}`);

    // Step 3: find the "Invoices" subfolder inside this contractor folder
    let subEntries: BoxEntry[] = [];
    try {
      subEntries = await listFolder(entry.id, boxToken);
    } catch (err) {
      result.errors.push(`${contractor.label} subfolder list: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const invoicesFolder = subEntries.find(
      (s) => s.type === "folder" && s.name.toLowerCase().includes("invoice"),
    );
    if (!invoicesFolder) {
      // No Invoices subfolder — try treating the contractor folder itself as the source
      result.errors.push(`${contractor.label}: no Invoices subfolder found in Box (checked ${subEntries.length} entries)`);
      continue;
    }

    // Step 4: list all PDFs in the Invoices subfolder (no date cutoff — full history)
    let invoiceFiles: BoxEntry[] = [];
    try {
      invoiceFiles = await listFolder(invoicesFolder.id, boxToken);
    } catch (err) {
      result.errors.push(`${contractor.label} invoices list: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const pdfs = invoiceFiles.filter(
      (f) => f.type === "file" && f.name.toLowerCase().endsWith(".pdf"),
    );
    result.pdfs_found += pdfs.length;

    // Step 5: for each PDF, download → Drive → fin_item
    for (const pdf of pdfs) {
      const boxId = `box:${pdf.id}`;
      if (captured.has(boxId)) {
        result.already_captured++;
        continue;
      }

      // Download from Box
      let bytes: Buffer | null = null;
      try {
        bytes = await downloadBoxFile(pdf.id, boxToken);
      } catch (err) {
        result.errors.push(`download ${pdf.name}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      if (!bytes) {
        result.errors.push(`download ${pdf.name}: empty response`);
        continue;
      }

      // Upload to Drive
      let driveLink: string | null = null;
      try {
        const datePrefix = (pdf.modified_at ?? new Date().toISOString()).slice(0, 10);
        const filename = `${datePrefix}_${contractor.label.replace(/ /g, "_")}_${pdf.name}`;
        const file = await uploadFileToDrive(filename, bytes, "application/pdf", folderId, driveToken);
        driveLink = file.webViewLink;
        result.uploaded++;
      } catch (err) {
        result.errors.push(`drive upload ${pdf.name}: ${err instanceof Error ? err.message : String(err)}`);
        // Still create the fin_item even if Drive upload failed
      }

      // Create fin_item
      const title = `invoice — ${contractor.label} — ${pdf.name.replace(/\.pdf$/i, "")}`.slice(0, 100);
      try {
        await createFinItem({
          type: "invoice",
          title,
          source: "box",
          notes: driveLink
            ? `Backfilled from Box. Drive: ${driveLink}`
            : `Backfilled from Box. File: ${pdf.name}`,
          raw_email_id: boxId,
        });
        result.fin_items_created++;
        result.items.push(title);
        captured.add(boxId);
      } catch (err) {
        result.errors.push(`fin_item ${pdf.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return json({ ...result, ok: true });
}

/**
 * Fin Box invoice scan — polls BOCS contractor invoice folders for new PDFs
 * uploaded by Maria or Lamis, then creates fin_items from them.
 *
 * Auth: Box developer token stored as CF secret BOX_DEV_TOKEN.
 * Tokens expire after 60 min and must be manually renewed:
 *   1. Visit app.box.com/developers/console/app/2595689/configuration
 *   2. Click Copy next to "Developer Token"
 *   3. Run: wrangler secret put BOX_DEV_TOKEN (paste new token)
 *
 * Required env var:
 *   BOX_DEV_TOKEN  — copied from Box Developer Console
 *
 * Folders scanned:
 *   302532645163  Maria Altamirano Gonzalez → Invoices
 *   302530801909  Sabra, Lamis → Invoices
 */

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../supabase/client";
import { createFinItem } from "@/lib/fin-data";

const BOX_API = "https://api.box.com/2.0";

const INVOICE_FOLDERS = [
  { id: "302532645163", label: "Maria Altamirano Gonzalez" },
  { id: "302530801909", label: "Sabra, Lamis" },
];

const LOOKBACK_DAYS = 45;

export interface BoxScanResult {
  folders_scanned: string[];
  seen: number;
  already_captured: number;
  created: number;
  skipped: number;
  items_created: string[];
  errors: string[];
  token_missing?: boolean;
}

interface BoxFileEntry {
  type: string;
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  created_by: { type: string; id: string; name: string; login: string };
}

async function listFolderFiles(
  token: string,
  folderId: string,
  cutoffIso: string,
): Promise<BoxFileEntry[]> {
  const url = `${BOX_API}/folders/${folderId}/items?fields=id,name,type,created_at,modified_at,created_by&limit=100&sort=date&direction=DESC`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Box folder ${folderId}: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { entries: BoxFileEntry[] };
  return (data.entries ?? []).filter(
    (f) => f.type === "file" && f.modified_at >= cutoffIso,
  );
}

async function getCapturedBoxIds(): Promise<Set<string>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("fin_items")
    .select("raw_email_id")
    .eq("source", "box")
    .gte("created_at", since)
    .not("raw_email_id", "is", null);
  return new Set((data ?? []).map((r) => r.raw_email_id as string));
}

async function classifyInvoice(
  filename: string,
  uploaderName: string,
  modifiedAt: string,
): Promise<{
  title: string;
  amount_cents: number | null;
  due_date: string | null;
  notes: string;
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const prompt = `Extract invoice details from a Box file uploaded by a BOCS contractor. Return JSON only.

File name: ${filename}
Uploaded by: ${uploaderName} (BOCS contractor for winded.vertigo collective)
File date: ${modifiedAt.slice(0, 10)}

Return this exact JSON shape:
{
  "title": "BOCS — <uploader first name> — <month year> invoice (max 100 chars)",
  "amount_cents": number or null (dollars × 100 — extract from filename if visible, else null),
  "due_date": "YYYY-MM-DD" or null,
  "notes": "one sentence — include filename for traceability"
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json
      ? (JSON.parse(json) as {
          title: string;
          amount_cents: number | null;
          due_date: string | null;
          notes: string;
        })
      : null;
  } catch {
    return null;
  }
}

export async function scanBoxInvoices(): Promise<BoxScanResult> {
  const result: BoxScanResult = {
    folders_scanned: INVOICE_FOLDERS.map((f) => f.label),
    seen: 0,
    already_captured: 0,
    created: 0,
    skipped: 0,
    items_created: [],
    errors: [],
  };

  const token = process.env.BOX_DEV_TOKEN;
  if (!token) {
    result.token_missing = true;
    result.errors.push(
      "BOX_DEV_TOKEN not set — see box-scan.ts header for renewal instructions",
    );
    return result;
  }

  const cutoff = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const captured = await getCapturedBoxIds();

  for (const folder of INVOICE_FOLDERS) {
    let files: BoxFileEntry[] = [];
    try {
      files = await listFolderFiles(token, folder.id, cutoff);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      // 401 means the token is expired
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        result.errors.push(
          "BOX_DEV_TOKEN appears expired — see box-scan.ts header for renewal instructions",
        );
        break;
      }
      continue;
    }

    result.seen += files.length;

    for (const file of files) {
      const boxId = `box:${file.id}`;
      if (captured.has(boxId)) {
        result.already_captured++;
        continue;
      }

      const classified = await classifyInvoice(
        file.name,
        file.created_by?.name ?? folder.label,
        file.modified_at,
      );
      if (!classified) {
        result.skipped++;
        continue;
      }

      try {
        const item = await createFinItem({
          type: "invoice",
          title: classified.title,
          source: "box",
          amount_cents: classified.amount_cents ?? undefined,
          due_date: classified.due_date ?? undefined,
          notes: classified.notes,
          raw_email_id: boxId,
        });
        result.created++;
        result.items_created.push(item.title);
      } catch (err) {
        result.errors.push(
          `create failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return result;
}

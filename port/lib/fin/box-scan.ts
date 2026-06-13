/**
 * Fin Box invoice scan — polls the BOCS contractor folder for new invoice
 * PDFs uploaded by Maria or Lamis, then creates fin_items from them.
 *
 * Auth: Box Server Authentication (JWT), enterprise sub-type.
 * The service account's enterprise token is used with "As-User" impersonation
 * so it reads Garrett's root folder rather than the service account's own.
 *
 * Required env vars (CF secrets):
 *   BOX_SA_KEY         — full JSON config downloaded from Box Developer Console
 *   BOX_ADMIN_USER_ID  — Garrett's Box user ID (from /2.0/users/me or app console)
 *
 * Optional:
 *   BOX_FOLDER_ID      — folder to scan (default "0" = root)
 */

import { createSign, createPrivateKey } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../supabase/client";
import { createFinItem } from "@/lib/fin-data";

const BOX_TOKEN_URL = "https://api.box.com/oauth2/token";
const BOX_API = "https://api.box.com/2.0";

// Substring matches against uploader name or login — catches Maria, Lameese,
// Lamis, and any future BOCS contractor accounts.
const BOCS_UPLOADERS = ["maria", "lameese", "lamis", "bocs"];

// Only look at files modified within this window to keep the scan cheap.
const LOOKBACK_DAYS = 7;

export interface BoxScanResult {
  folder_id: string;
  seen: number;
  already_captured: number;
  created: number;
  skipped: number;
  items_created: string[];
  errors: string[];
}

interface BoxKeyFile {
  boxAppSettings: {
    clientID: string;
    clientSecret: string;
    appAuth: {
      publicKeyID: string;
      privateKey: string;
      passphrase?: string;
    };
  };
  enterpriseID: string;
}

interface BoxFileEntry {
  type: string;
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  created_by: { type: string; id: string; name: string; login: string };
}

async function getBoxEnterpriseToken(keyJson: string): Promise<{ token: string; clientID: string; clientSecret: string }> {
  const cfg = JSON.parse(keyJson) as BoxKeyFile;
  const { clientID, clientSecret, appAuth } = cfg.boxAppSettings;
  const { publicKeyID, privateKey, passphrase } = appAuth;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT", kid: publicKeyID };
  const payload = {
    iss: clientID,
    sub: cfg.enterpriseID,
    box_sub_type: "enterprise",
    aud: BOX_TOKEN_URL,
    jti: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    exp: now + 60,
  };

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  // createPrivateKey handles passphrase-encrypted PEM; fall back to raw string
  // for unencrypted keys (Box dev console can generate either).
  const privKey = passphrase
    ? createPrivateKey({ key: privateKey, passphrase, format: "pem" })
    : privateKey;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(privKey, "base64url");

  const res = await fetch(BOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${signature}`,
      client_id: clientID,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) throw new Error(`Box token exchange failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string };
  return { token: data.access_token, clientID, clientSecret };
}

async function listFolderFiles(
  token: string,
  folderId: string,
  asUserId: string,
  cutoffIso: string,
): Promise<BoxFileEntry[]> {
  const url = `${BOX_API}/folders/${folderId}/items?fields=id,name,type,created_at,modified_at,created_by&limit=100&sort=date&direction=DESC`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "As-User": asUserId,
    },
  });
  if (!res.ok) throw new Error(`Box folder list failed: ${await res.text()}`);
  const data = await res.json() as { entries: BoxFileEntry[] };
  return (data.entries ?? []).filter(
    (f) => f.type === "file" && f.modified_at >= cutoffIso,
  );
}

function isBocsUploader(f: BoxFileEntry): boolean {
  const name = (f.created_by?.name ?? "").toLowerCase();
  const login = (f.created_by?.login ?? "").toLowerCase();
  return BOCS_UPLOADERS.some((u) => name.includes(u) || login.includes(u));
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
): Promise<{ title: string; amount_cents: number | null; due_date: string | null; notes: string } | null> {
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
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? (JSON.parse(json) as { title: string; amount_cents: number | null; due_date: string | null; notes: string }) : null;
  } catch {
    return null;
  }
}

export async function scanBoxInvoices(): Promise<BoxScanResult> {
  const folderId = process.env.BOX_FOLDER_ID ?? "0";
  const result: BoxScanResult = {
    folder_id: folderId,
    seen: 0,
    already_captured: 0,
    created: 0,
    skipped: 0,
    items_created: [],
    errors: [],
  };

  const keyJson = process.env.BOX_SA_KEY;
  const asUserId = process.env.BOX_ADMIN_USER_ID;
  if (!keyJson) {
    result.errors.push("BOX_SA_KEY not set — run: wrangler secret put BOX_SA_KEY");
    return result;
  }
  if (!asUserId) {
    result.errors.push("BOX_ADMIN_USER_ID not set — run: wrangler secret put BOX_ADMIN_USER_ID");
    return result;
  }

  let token: string;
  try {
    ({ token } = await getBoxEnterpriseToken(keyJson));
  } catch (err) {
    result.errors.push(`Box auth: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const captured = await getCapturedBoxIds();

  let files: BoxFileEntry[] = [];
  try {
    files = await listFolderFiles(token, folderId, asUserId, cutoff);
  } catch (err) {
    result.errors.push(`Box folder: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const bocsFiles = files.filter(isBocsUploader);
  result.seen = bocsFiles.length;

  for (const file of bocsFiles) {
    const boxId = `box:${file.id}`;
    if (captured.has(boxId)) {
      result.already_captured++;
      continue;
    }

    const classified = await classifyInvoice(
      file.name,
      file.created_by?.name ?? "BOCS",
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
      result.errors.push(`create failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

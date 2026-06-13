/**
 * Fin financial email scan — daily cron that captures bills, invoices,
 * tax notices, and payroll alerts from garrett@windedvertigo.com.
 *
 * Two scan passes run in sequence:
 *
 *   1. FINANCIAL SENDERS — known financial domains (ADP, Gusto, IRS…).
 *      Haiku classifies each; financial items land in fin_items.
 *
 *   2. INVOICE ATTACHMENTS — any email with a PDF attachment whose subject
 *      contains "invoice" or "factura" in the last 7 days. These are BOCS
 *      contractor invoices (Maria, Lamis). For each:
 *        a. Download the PDF via Gmail Attachment API
 *        b. Upload to Google Drive (GOOGLE_DRIVE_INVOICE_FOLDER_ID)
 *        c. Create fin_item of type "invoice"
 *        d. Send Resend notification to garrett@ so he can pay quickly
 *
 * Required env vars for pass 2:
 *   GOOGLE_DRIVE_INVOICE_FOLDER_ID — Drive folder ID for contractor invoices
 *
 * Drive prerequisite (one-time):
 *   In Google Workspace Admin, add https://www.googleapis.com/auth/drive
 *   to client ID 109146183570982842405 in domain-wide delegation settings.
 */

import {
  getMessageWithBody,
  getServiceAccountAccessToken,
  listMessages,
  downloadAttachment,
} from "@/lib/gmail";
import { getDriveToken, uploadFileToDrive } from "@/lib/drive";
import { sendOutreachEmail } from "@/lib/email/resend";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../supabase/client";
import { createFinItem, type FinItemType } from "@/lib/fin-data";

const WORKSPACE_SUBJECT = "garrett@windedvertigo.com";
const MAX_MESSAGES = 25;

// Senders whose emails are always worth classifying
const FINANCIAL_SENDERS = [
  "adp.com",
  "gusto.com",
  "gustonoreply@gusto.com",
  "straighttalkcpas.com",
  "taxdome.com",
  "concursolutions.com",
  "unglobalcompact.org",
  "invoice.updates@adp.com",
  "stripe.com",
  "irs.gov",
  "revenue.wi.gov",
  "quickbooks.intuit.com",
  "intuit.com",
];

const SENDER_QUERY = FINANCIAL_SENDERS.map((s) => `from:${s}`).join(" OR ");
const GMAIL_QUERY = `(${SENDER_QUERY}) newer_than:3d`;
const INVOICE_ATTACHMENT_QUERY =
  `has:attachment filename:pdf (subject:invoice OR subject:factura OR subject:rechnung) newer_than:7d`;

export interface FinEmailScanResult {
  account: string;
  seen: number;
  already_captured: number;
  created: number;
  skipped: number;
  items_created: string[];
  errors: string[];
  drive_uploads: number;
  notifications_sent: number;
}

/** Return message IDs already captured this week so we don't double-log. */
async function getCapturedMessageIds(): Promise<Set<string>> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("fin_items")
    .select("raw_email_id")
    .eq("source", "gmail")
    .gte("created_at", since)
    .not("raw_email_id", "is", null);
  return new Set((data ?? []).map((r) => r.raw_email_id as string));
}

interface ClassifiedEmail {
  is_financial: boolean;
  type: FinItemType;
  title: string;
  amount_cents: number | null;
  due_date: string | null;
  notes: string;
}

async function classifyWithHaiku(
  subject: string,
  snippet: string,
  sender: string,
): Promise<ClassifiedEmail | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const prompt = `Classify this email for a financial action-item tracker. Return JSON only.

Sender: ${sender}
Subject: ${subject}
Snippet: ${snippet}

Return this exact JSON shape:
{
  "is_financial": true/false,
  "type": one of: "bill"|"invoice"|"tax_notice"|"deadline"|"bank_alert"|"taxdome_message"|"renewal"|"other",
  "title": "short action-item description (max 100 chars)",
  "amount_cents": number or null,
  "due_date": "YYYY-MM-DD" or null,
  "notes": "any useful context in 1 sentence"
}

Only return is_financial=true if this requires a human financial action or decision.
Automatic confirmations (e.g. "your payment has been processed") should be is_financial=false.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    return JSON.parse(json) as ClassifiedEmail;
  } catch {
    return null;
  }
}

async function sendInvoiceNotification(
  title: string,
  from: string,
  amountCents: number | null,
  dueDate: string | null,
  driveLink: string | null,
): Promise<void> {
  const amt = amountCents != null
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100)
    : "amount unknown";
  const due = dueDate ? `due ${dueDate}` : "no due date set";
  const driveHtml = driveLink
    ? `<p><a href="${driveLink}">view invoice in google drive →</a></p>`
    : "";
  const finnLink = "https://port.windedvertigo.com/finn";

  await sendOutreachEmail({
    from: "finn <finn@windedvertigo.com>",
    to: WORKSPACE_SUBJECT,
    subject: `invoice received — ${title.slice(0, 60)}`,
    html: `<p>a contractor invoice just landed and needs payment.</p>
<ul>
  <li><strong>from:</strong> ${from}</li>
  <li><strong>amount:</strong> ${amt}</li>
  <li><strong>${due}</strong></li>
</ul>
${driveHtml}
<p><a href="${finnLink}">open finn dashboard →</a></p>`,
    text: `invoice received: ${title}\nfrom: ${from}\namount: ${amt}\n${due}\n${driveLink ?? ""}\n${finnLink}`,
    replyTo: WORKSPACE_SUBJECT,
  });
}

export async function scanFinancialEmails(): Promise<FinEmailScanResult> {
  const result: FinEmailScanResult = {
    account: WORKSPACE_SUBJECT,
    seen: 0,
    already_captured: 0,
    created: 0,
    skipped: 0,
    items_created: [],
    errors: [],
    drive_uploads: 0,
    notifications_sent: 0,
  };

  const saKey =
    process.env.GOOGLE_SA_RFP_SCANNER ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saKey) {
    result.errors.push("no service account key — set GOOGLE_SA_RFP_SCANNER");
    return result;
  }

  let token: string;
  try {
    token = await getServiceAccountAccessToken(saKey, WORKSPACE_SUBJECT);
  } catch (err) {
    result.errors.push(
      `token error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }

  const captured = await getCapturedMessageIds();

  // ── pass 1: known financial senders ──────────────────────────────────────
  let messages: { id: string; threadId: string }[] = [];
  try {
    messages = await listMessages(GMAIL_QUERY, token, MAX_MESSAGES, WORKSPACE_SUBJECT);
  } catch (err) {
    result.errors.push(
      `gmail list error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  result.seen += messages.length;

  for (const msg of messages) {
    if (captured.has(msg.id)) {
      result.already_captured++;
      continue;
    }

    let full: Awaited<ReturnType<typeof getMessageWithBody>> = null;
    try {
      full = await getMessageWithBody(msg.id, token, WORKSPACE_SUBJECT);
    } catch {
      result.skipped++;
      continue;
    }

    if (!full) { result.skipped++; continue; }

    const classified = await classifyWithHaiku(
      full.subject,
      full.body.slice(0, 500),
      full.from,
    );

    if (!classified?.is_financial) {
      result.skipped++;
      await createFinItem({
        type: "other",
        title: `[skip] ${full.subject?.slice(0, 80) ?? "no subject"}`,
        source: "gmail",
        notes: "auto-scan: classified as non-actionable",
        raw_email_id: msg.id,
      }).catch(() => null);
      continue;
    }

    try {
      const item = await createFinItem({
        type: classified.type,
        title: classified.title,
        source: "gmail",
        amount_cents: classified.amount_cents ?? undefined,
        due_date: classified.due_date ?? undefined,
        notes: classified.notes,
        raw_email_id: msg.id,
      });
      result.created++;
      result.items_created.push(`[${item.type}] ${item.title}`);
      captured.add(msg.id);
    } catch (err) {
      result.errors.push(
        `create failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── pass 2: invoice PDF attachments (BOCS contractors) ───────────────────
  const folderId = process.env.GOOGLE_DRIVE_INVOICE_FOLDER_ID;

  let invoiceMsgs: { id: string; threadId: string }[] = [];
  try {
    invoiceMsgs = await listMessages(INVOICE_ATTACHMENT_QUERY, token, 10, WORKSPACE_SUBJECT);
  } catch (err) {
    result.errors.push(
      `invoice attachment query error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  result.seen += invoiceMsgs.length;

  for (const msg of invoiceMsgs) {
    if (captured.has(msg.id)) { result.already_captured++; continue; }

    let full: Awaited<ReturnType<typeof getMessageWithBody>> = null;
    try {
      full = await getMessageWithBody(msg.id, token, WORKSPACE_SUBJECT);
    } catch {
      result.skipped++;
      continue;
    }

    if (!full) { result.skipped++; continue; }

    const pdfAttachments = full.attachments.filter(
      (a) => a.mimeType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf"),
    );
    if (pdfAttachments.length === 0) { result.skipped++; continue; }

    const pdf = pdfAttachments[0];

    let pdfBytes: Buffer | null = null;
    try {
      pdfBytes = await downloadAttachment(msg.id, pdf.attachmentId, token, WORKSPACE_SUBJECT);
    } catch (err) {
      result.errors.push(`attachment download: ${err instanceof Error ? err.message : String(err)}`);
    }

    let driveLink: string | null = null;
    if (pdfBytes && folderId) {
      try {
        const driveToken = await getDriveToken(saKey);
        const datePrefix = new Date().toISOString().slice(0, 10);
        const driveFile = await uploadFileToDrive(
          `${datePrefix}_${pdf.filename}`,
          pdfBytes,
          "application/pdf",
          folderId,
          driveToken,
        );
        driveLink = driveFile.webViewLink;
        result.drive_uploads++;
      } catch (err) {
        result.errors.push(`drive upload: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const title = `invoice — ${full.from.replace(/<.*>/, "").trim()} — ${full.subject.slice(0, 60)}`.slice(0, 100);
    let created = false;
    try {
      const item = await createFinItem({
        type: "invoice",
        title,
        source: "gmail",
        notes: driveLink
          ? `PDF saved to Drive: ${driveLink}`
          : `PDF attached to email. Subject: ${full.subject}`,
        raw_email_id: msg.id,
      });
      result.created++;
      result.items_created.push(`[invoice] ${item.title}`);
      captured.add(msg.id);
      created = true;
    } catch (err) {
      result.errors.push(`create invoice item: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (created) {
      try {
        await sendInvoiceNotification(title, full.from, null, null, driveLink);
        result.notifications_sent++;
      } catch (err) {
        result.errors.push(`notification: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return result;
}

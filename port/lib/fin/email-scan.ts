/**
 * Fin financial email scan — daily cron that captures bills, invoices,
 * tax notices, and payroll alerts from garrett@windedvertigo.com.
 *
 * Uses the same service-account delegation pattern as opsy/email-scan.ts.
 * Claude Haiku classifies each message; results land in fin_items.
 * Deduplication is by Gmail message ID (raw_email_id column).
 */

import {
  getMessageWithBody,
  getServiceAccountAccessToken,
  listMessages,
} from "@/lib/gmail";
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

export interface FinEmailScanResult {
  account: string;
  seen: number;
  already_captured: number;
  created: number;
  skipped: number;
  items_created: string[];
  errors: string[];
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

export async function scanFinancialEmails(): Promise<FinEmailScanResult> {
  const result: FinEmailScanResult = {
    account: WORKSPACE_SUBJECT,
    seen: 0,
    already_captured: 0,
    created: 0,
    skipped: 0,
    items_created: [],
    errors: [],
  };

  // Resolve service-account token (same delegation as opsy + rfp scanner)
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

  let messages: { id: string; threadId: string }[] = [];
  try {
    messages = await listMessages(GMAIL_QUERY, token, MAX_MESSAGES, WORKSPACE_SUBJECT);
  } catch (err) {
    result.errors.push(
      `gmail list error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }

  result.seen = messages.length;

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
      // Still mark as seen so we don't re-evaluate it
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
    } catch (err) {
      result.errors.push(
        `create failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

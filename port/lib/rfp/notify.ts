/**
 * Slack notification for newly-ingested RFP opportunities.
 *
 * Called at the END of each poller run (RSS, Feedly, Gmail scanner) with the
 * array of opportunities that were successfully created. Posts ONE summary
 * message to the configured channel, tagging the people who should triage.
 *
 * Batching is intentional: the three pollers fire in a tight morning window
 * (8:00/8:15/8:30 UTC) so per-item pings would produce ~30 notifications over
 * ~30 minutes. One summary per run = max 3 messages per morning, one per
 * source, and only when the source actually had hits.
 *
 * Fail-open: Slack errors are logged, never thrown. A poller should never
 * fail to record RFPs because Slack hiccupped.
 */

import { postToChannel, buildMentionsFromEmails } from "@/lib/slack";
import type { TorStatus } from "@/lib/ai/rfp-ingest";

// ── config ────────────────────────────────────────────────

/** Channel name (with #) or ID. Configurable via env; sensible default. */
const CHANNEL = process.env.SLACK_RFP_CHANNEL ?? "#funding-opportunities";

/**
 * CSV of emails to @-mention when new RFPs land. Resolved to Slack user IDs
 * at send time via users.lookupByEmail. Unresolvable emails are silently
 * dropped so a typo doesn't turn into a plaintext email leak.
 *
 * Default: Garrett + Maria (the two people who triage incoming opportunities
 * into pursuing/decline status).
 */
const MENTION_EMAILS_CSV =
  process.env.SLACK_RFP_MENTION_EMAILS ??
  "garrett@windedvertigo.com,maria@windedvertigo.com";

const MENTION_EMAILS = MENTION_EMAILS_CSV
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// ── types ─────────────────────────────────────────────────

export interface NewRfpItem {
  /** Human-readable opportunity name, from triage. */
  name: string;
  /** Fit score string from triage (e.g. "🟢 High", "🟡 Medium"). */
  fitScore: string;
  /** YYYY-MM-DD deadline if known; undefined if enrichment couldn't find one. */
  dueDate?: string;
  /** Canonical opportunity URL if known. */
  url?: string;
  /** Notion page ID — used to build a deep-link into the port's RFP detail view. */
  notionPageId: string;
  /**
   * Where the TOR landed after ingest:
   *   - "pdf"     → rfpDocumentUrl points at the remote TOR/RFP PDF (or doc link)
   *   - "inline"  → the announcement body was the TOR; torUrl points at the R2 .txt copy
   *   - "missing" → no TOR recorded; this opp needs manual follow-up
   */
  torStatus: TorStatus;
  /** URL of the TOR asset (remote PDF or R2-stored .txt). Omitted when torStatus is "missing". */
  torUrl?: string;
}

/** Where the batch came from — used as a subtitle in the Slack message. */
export type NotificationSource =
  | "RSS feeds"
  | "Feedly"
  | "Gmail alerts"
  | "webhook";

// ── helpers ───────────────────────────────────────────────

/** Short, human-friendly "days until deadline" suffix for the due-date field. */
function formatDueDate(dueDate: string | undefined): string {
  if (!dueDate) return "_no deadline extracted yet_";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const ms = due.getTime() - today.getTime();
  const days = Math.round(ms / 86_400_000);

  const pretty = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (Number.isNaN(days)) return `*${pretty}*`;
  if (days < 0) return `*${pretty}* (${Math.abs(days)}d overdue)`;
  if (days === 0) return `*${pretty}* (today)`;
  if (days === 1) return `*${pretty}* (tomorrow)`;
  if (days <= 14) return `*${pretty}* (in ${days}d)`;
  return `*${pretty}* (in ${days}d)`;
}

/** Base URL for the port — used to build deep-links into RFP detail pages. */
function portBaseUrl(): string {
  // NEXT_PUBLIC_PORT_URL is set in prod; local dev falls back to the default dev port.
  return process.env.NEXT_PUBLIC_PORT_URL ?? "https://port.windedvertigo.com";
}

/**
 * Render the TOR-status segment for a per-RFP bullet line.
 *   - "pdf"     → 📄 attached  (linked if torUrl present)
 *   - "inline"  → 📝 inline    (linked to the R2-stored .txt if torUrl present)
 *   - "missing" → ⚠️ not found (no link)
 */
function formatTorStatus(status: TorStatus, torUrl?: string): string {
  if (status === "missing") return "⚠️ not found";
  const label = status === "pdf" ? "📄 attached" : "📝 inline";
  if (torUrl) return `${label} (<${torUrl}|view>)`;
  return label;
}

// ── main entry point ──────────────────────────────────────

/**
 * Post a Slack summary of newly-ingested RFPs to the configured channel.
 * No-ops when `items` is empty.
 */
export async function notifyNewRfps(
  items: NewRfpItem[],
  source: NotificationSource,
): Promise<void> {
  if (items.length === 0) return;

  try {
    const mentions = await buildMentionsFromEmails(MENTION_EMAILS);
    const base = portBaseUrl();

    // Header: count + source + mentions (mentions trail so they're easy to skim past).
    const plural = items.length === 1 ? "opportunity" : "opportunities";
    const headerText = `🎯 *${items.length} new ${plural} on the radar* — via ${source}`;

    // Build one bullet per RFP. Slack mrkdwn link syntax is <url|label>; if no
    // URL is known we just show the name and deep-link to the Notion-backed
    // port detail page as the primary action.
    const bullets = items.map((it) => {
      const portLink = `${base}/rfp-radar/${it.notionPageId}`;
      const primary = `<${portLink}|${escapeMrkdwn(it.name)}>`;
      const sourceLink = it.url ? `  ·  <${it.url}|source>` : "";
      const torSegment = `  ·  tor: ${formatTorStatus(it.torStatus, it.torUrl)}`;
      return `• ${primary} — fit: ${it.fitScore}  ·  due: ${formatDueDate(it.dueDate)}${sourceLink}${torSegment}`;
    });

    // "Manual action needed" callout — lists every item whose TOR is missing.
    // Goes AFTER the main bullets, BEFORE the @mentions line.
    const missingItems = items.filter((it) => it.torStatus === "missing");
    let missingCallout = "";
    if (missingItems.length > 0) {
      const missingPlural = missingItems.length === 1 ? "opportunity" : "opportunities";
      const missingLines = missingItems.map((it) => {
        const portLink = `${base}/rfp-radar/${it.notionPageId}`;
        const primary = `<${portLink}|${escapeMrkdwn(it.name)}>`;
        const sourceLink = it.url ? `  ·  <${it.url}|source>` : "";
        return `• ${primary}${sourceLink}`;
      });
      missingCallout = [
        "",
        `⚠️ *TOR not found for ${missingItems.length} ${missingPlural}* — please help track these down:`,
        ...missingLines,
      ].join("\n");
    }

    const text = [
      headerText,
      "",
      ...bullets,
      missingCallout || null,
      mentions && `\n${mentions}`,
    ]
      .filter(Boolean)
      .join("\n");

    const ok = await postToChannel(CHANNEL, text);
    if (!ok) {
      console.warn(`[rfp/notify] posted=false — check SLACK_BOT_TOKEN + bot is invited to ${CHANNEL}`);
    }
  } catch (err) {
    // Never fail-loud from notification code. Poller should still return its result.
    console.error("[rfp/notify] unexpected error:", err);
  }
}

/**
 * Escape Slack mrkdwn special characters inside an opportunity name so titles
 * like "RFP: Evaluation & Research (2026)" don't blow up formatting. Slack
 * uses <,>,& as link/mention delimiters; the rest is safe.
 */
function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

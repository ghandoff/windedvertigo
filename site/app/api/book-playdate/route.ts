/**
 * POST /api/book-playdate
 *
 * Captures visitor context before scheduling a playdate call.
 * Logs to Notion CRM, sends notification to team, and sends
 * confirmation to visitor with calendar booking link.
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

/* ── constants ── */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";
const REPLY_TO = "hello@windedvertigo.com";
const CALENDAR_LINK = "https://calendar.app.google/ZXVqJLdprmUZk1DW6";

const VALID_QUADRANTS = new Set([
  "people-design",
  "people-research",
  "product-design",
  "product-research",
]);

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people × design",
  "people-research": "people × research",
  "product-design": "product × design",
  "product-research": "product × research",
};

// CRM contacts data source ID
const CRM_CONTACTS_DB = "829cd552-4516-45b7-a65b-2bcd8d47ff81";

/* ── rate limiting (in-memory, per-instance) ── */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_DAY = 3;

let globalHourly = { count: 0, resetAt: Date.now() + 3_600_000 };
const MAX_PER_HOUR_GLOBAL = 50;

function isRateLimited(email: string): boolean {
  const now = Date.now();

  // global hourly cap
  if (now > globalHourly.resetAt) {
    globalHourly = { count: 1, resetAt: now + 3_600_000 };
  } else {
    if (globalHourly.count >= MAX_PER_HOUR_GLOBAL) return true;
    globalHourly.count++;
  }

  // per-email daily cap
  const entry = rateLimitMap.get(email);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 86_400_000 });
    return false;
  }

  if (entry.count >= MAX_PER_DAY) return true;
  entry.count++;
  return false;
}

/* ── notion contact logging ── */

async function logContactToNotion(params: {
  name: string;
  email: string;
  quadrant: string | null;
  quadrantHistory: string[];
  curious: string;
  valuable: string;
}): Promise<void> {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn("[book-playdate] NOTION_TOKEN not set — skipping lead log");
    return;
  }

  const notion = new Client({ auth: token });
  const label = params.quadrant ? (QUADRANT_LABELS[params.quadrant] ?? params.quadrant) : "no quadrant";
  const historyLabels = params.quadrantHistory
    .filter((q) => q !== params.quadrant)
    .map((q) => QUADRANT_LABELS[q] ?? q);

  let nextAction = `playdate booked: ${label}`;
  if (params.curious) nextAction += ` — curious about: ${params.curious}`;
  if (params.valuable) nextAction += ` — values: ${params.valuable}`;
  if (historyLabels.length > 0) nextAction += ` — also explored: ${historyLabels.join(", ")}`;

  // truncate to Notion's rich_text limit
  if (nextAction.length > 2000) nextAction = nextAction.slice(0, 1997) + "…";

  const today = new Date().toISOString().split("T")[0];

  // check for existing contact by email
  try {
    const existing = await notion.databases.query({
      database_id: CRM_CONTACTS_DB,
      filter: {
        property: "email",
        email: { equals: params.email },
      },
      page_size: 1,
    });

    if (existing.results.length > 0) {
      const pageId = existing.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: {
          "contact warmth": { select: { name: "warm" } },
          "last contacted": { date: { start: today } },
          "next action": {
            rich_text: [{ text: { content: nextAction } }],
          },
        },
      });
      return;
    }
  } catch (err) {
    console.warn("[book-playdate] contact dedup query failed:", err);
  }

  // create new contact
  await notion.pages.create({
    parent: { database_id: CRM_CONTACTS_DB },
    properties: {
      "first & last name": {
        title: [{ text: { content: params.name } }],
      },
      "email": { email: params.email },
      "contact warmth": { select: { name: "warm" } },
      "relationship stage": { select: { name: "introduced" } },
      "last contacted": { date: { start: today } },
      "next action": {
        rich_text: [{ text: { content: nextAction } }],
      },
    },
  });
}

/* ── email helpers ── */

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[book-playdate] RESEND_API_KEY not set");
    return { success: false, error: "email service not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        reply_to: params.replyTo,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[book-playdate] resend error:", data);
      return { success: false, error: data.message || `resend returned ${res.status}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "network error";
    console.error("[book-playdate] email send failed:", err);
    return { success: false, error: message };
  }
}

function buildNotificationHtml(params: {
  name: string;
  email: string;
  quadrant: string | null;
  quadrantHistory: string[];
  curious: string;
  valuable: string;
}): string {
  const label = params.quadrant ? (QUADRANT_LABELS[params.quadrant] ?? params.quadrant) : "no quadrant";
  const historyLabels = params.quadrantHistory.map((q) => QUADRANT_LABELS[q] ?? q);

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 20px; font-weight: 600; margin-bottom: 4px; text-transform: lowercase;">
        playdate booked
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 24px;">
        winded.vertigo
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #273248; opacity: 0.6; vertical-align: top; width: 100px;">name</td>
          <td style="padding: 8px 0; font-size: 14px; color: #273248; font-weight: 500;">${escapeHtml(params.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #273248; opacity: 0.6; vertical-align: top;">email</td>
          <td style="padding: 8px 0; font-size: 14px; color: #273248;"><a href="mailto:${escapeHtml(params.email)}" style="color: #b15043;">${escapeHtml(params.email)}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #273248; opacity: 0.6; vertical-align: top;">quadrant</td>
          <td style="padding: 8px 0; font-size: 14px; color: #273248; font-weight: 500;">${escapeHtml(label)}</td>
        </tr>
        ${historyLabels.length > 0 ? `
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #273248; opacity: 0.6; vertical-align: top;">explored</td>
          <td style="padding: 8px 0; font-size: 14px; color: #273248;">${escapeHtml(historyLabels.join(", "))}</td>
        </tr>
        ` : ""}
      </table>

      ${params.curious || params.valuable ? `
      <div style="background: #273248; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        ${params.curious ? `
        <div style="margin-bottom: ${params.valuable ? "16px" : "0"};">
          <div style="font-size: 11px; color: #cb7858; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">what made them curious</div>
          <div style="font-size: 14px; color: #ffffff; line-height: 1.6;">${escapeHtml(params.curious)}</div>
        </div>
        ` : ""}
        ${params.valuable ? `
        <div>
          <div style="font-size: 11px; color: #cb7858; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">what feels valuable</div>
          <div style="font-size: 14px; color: #ffffff; line-height: 1.6;">${escapeHtml(params.valuable)}</div>
        </div>
        ` : ""}
      </div>
      ` : ""}

      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 28px 0 16px;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px; margin: 0;">
        winded.vertigo · playdate intake notification
      </p>
    </div>
  `;
}

function buildConfirmationHtml(name: string): string {
  const firstName = name.split(" ")[0].toLowerCase();

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 20px; font-weight: 600; margin-bottom: 4px; text-transform: lowercase;">
        your playdate is almost booked
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 24px;">
        winded.vertigo
      </p>

      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        thanks ${escapeHtml(firstName)},
      </p>

      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        we've got your details and we're looking forward to meeting you. pick a time that works and we'll take it from there — no prep needed, just curiosity.
      </p>

      <a
        href="${CALENDAR_LINK}"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-transform: lowercase;"
      >
        choose a time →
      </a>

      <p style="color: #273248; opacity: 0.7; font-size: 13px; line-height: 1.6; margin-top: 24px;">
        have questions before we chat? hit reply — it goes straight to our team.
      </p>

      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 28px 0 16px;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px; margin: 0;">
        winded.vertigo · you're receiving this because you booked a playdate
      </p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── handler ── */

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const curious = typeof body.curious === "string" ? body.curious.trim().slice(0, 1000) : "";
  const valuable = typeof body.valuable === "string" ? body.valuable.trim().slice(0, 1000) : "";
  const quadrant = typeof body.quadrant === "string" && VALID_QUADRANTS.has(body.quadrant) ? body.quadrant : null;
  const quadrantHistory = Array.isArray(body.quadrantHistory)
    ? body.quadrantHistory.filter((q): q is string => typeof q === "string" && VALID_QUADRANTS.has(q))
    : [];

  // validation
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email is required" }, { status: 400 });
  }

  // rate limit
  if (isRateLimited(email)) {
    return NextResponse.json(
      { error: "you've already booked today — check your inbox for the calendar link" },
      { status: 429 },
    );
  }

  try {
    const label = quadrant ? (QUADRANT_LABELS[quadrant] ?? quadrant) : "general";

    // send emails + log contact in parallel
    const [notifResult, confirmResult] = await Promise.all([
      sendEmail({
        to: REPLY_TO,
        subject: `playdate booked — ${name} — ${label}`,
        html: buildNotificationHtml({ name, email, quadrant, quadrantHistory, curious, valuable }),
      }),
      sendEmail({
        to: email,
        subject: "your playdate is almost booked — winded.vertigo",
        html: buildConfirmationHtml(name),
        replyTo: REPLY_TO,
      }),
      logContactToNotion({ name, email, quadrant, quadrantHistory, curious, valuable }).catch((err) => {
        console.error("[book-playdate] failed to log contact:", err);
      }),
    ]);

    if (!notifResult.success) {
      console.error("[book-playdate] notification email failed:", notifResult.error);
    }

    if (!confirmResult.success) {
      return NextResponse.json(
        { error: confirmResult.error ?? "failed to send confirmation" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[book-playdate] unexpected error:", err);
    return NextResponse.json(
      { error: "something went wrong — please try again" },
      { status: 500 },
    );
  }
}

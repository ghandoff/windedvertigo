/**
 * Booking email templates + Resend transport.
 *
 * HTML primitives (shell, ctaButton, escapeHtml, date helpers) come from
 * @windedvertigo/email-templates — do not duplicate them here.
 *
 * Four templates:
 *   - visitorConfirmation  → booking confirmed (with cancel/reschedule links)
 *   - hostNotification     → "you have a booking"
 *   - visitorCancellation  → booking cancelled
 *   - hostCancellation     → host notified of cancellation
 *   - visitorReschedule    → visitor sees old + new time
 *   - hostReschedule       → host notified of move
 *
 * Resend transport uses raw fetch — the `resend` npm SDK is not compatible
 * with the Cloudflare Workers runtime (missing Node.js APIs). Site runs on
 * CF Workers via OpenNext, so we call the REST API directly.
 */

import {
  escapeHtml,
  wvShell,
  ctaButton,
  wvCallout,
  wvDarkCard,
  wvDarkRow,
  wvCompactRow,
  wvPara,
  formatDateRange,
  formatDateOnly,
} from "@windedvertigo/email-templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";
const REPLY_TO = process.env.PACKAGE_REPLY_TO ?? "hello@windedvertigo.com";

export interface BookingEmailContext {
  visitorName: string;
  visitorEmail: string;
  visitorTz: string;
  hostNames: string[];
  hostEmails: string[];
  eventTitle: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  meetUrl: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
  intake?: { curious?: string; valuable?: string; quadrant?: string | null };
}

/* ── transport ─────────────────────────────────────────────────── */

interface ResendResult {
  success: boolean;
  error?: string;
  id?: string;
}

async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<ResendResult> {
  if (!RESEND_API_KEY) {
    console.error("[booking.email] RESEND_API_KEY not set");
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
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        reply_to: opts.replyTo ?? REPLY_TO,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const errMsg =
        typeof data === "object" && data && "message" in data
          ? String((data as { message?: string }).message)
          : `resend ${res.status}`;
      console.error("[booking.email] resend api error:", errMsg);
      return { success: false, error: errMsg };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { success: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error("[booking.email] failed to send:", msg);
    return { success: false, error: msg };
  }
}

/* ── shared helpers ────────────────────────────────────────────── */

// Re-export escapeHtml so existing callers in this package don't need updating.
export { escapeHtml };

function meetingDetails(c: BookingEmailContext): string {
  const when = formatDateRange(c.startAt, c.endAt, c.visitorTz);
  const hosts =
    c.hostNames.length === 1
      ? c.hostNames[0]
      : c.hostNames.slice(0, -1).join(", ") + " and " + c.hostNames[c.hostNames.length - 1];
  return wvCallout(`
    <div style="font-size: 13px; color: #273248; opacity: 0.6; margin-bottom: 4px; text-transform: lowercase;">${escapeHtml(c.eventTitle)}</div>
    <div style="font-size: 15px; color: #273248; font-weight: 600; margin-bottom: 6px;">${escapeHtml(when)}</div>
    <div style="font-size: 13px; color: #273248; opacity: 0.7;">with ${escapeHtml(hosts)} · ${c.durationMin} min</div>
    ${c.meetUrl ? `<div style="font-size: 13px; color: #273248; margin-top: 10px;">join → <a href="${c.meetUrl}" style="color: #b15043;">${escapeHtml(c.meetUrl)}</a></div>` : ""}
  `);
}

/* ── templates ─────────────────────────────────────────────────── */

export function buildVisitorConfirmationHtml(c: BookingEmailContext): string {
  const firstName = c.visitorName.split(" ")[0].toLowerCase();
  return wvShell(
    "your playdate is booked",
    `
      ${wvPara(`hi ${escapeHtml(firstName)},`)}
      ${wvPara("we're looking forward to playing with you.", "20px")}
      ${meetingDetails(c)}
      ${wvPara("we've added it to your calendar — see you soon.", "20px")}
      <div style="margin-top: 8px;">
        ${ctaButton(c.rescheduleUrl, "reschedule", "ghost")}
        ${ctaButton(c.cancelUrl, "cancel", "ghost")}
      </div>
    `,
    "winded.vertigo · you'll get this confirmation any time you book a playdate",
  );
}

export function buildHostNotificationHtml(
  c: BookingEmailContext,
  forHostName: string,
): string {
  const intakeBlock =
    c.intake?.curious || c.intake?.valuable
      ? wvDarkCard(`
          ${c.intake.curious ? wvDarkRow("what made them curious", c.intake.curious, !c.intake.valuable) : ""}
          ${c.intake.valuable ? wvDarkRow("what feels valuable", c.intake.valuable, true) : ""}
        `)
      : "";

  return wvShell(
    "new playdate booked",
    `
      ${wvPara(`hi ${escapeHtml(forHostName)},`)}
      ${wvPara(`${escapeHtml(c.visitorName)} (${escapeHtml(c.visitorEmail)}) just booked a playdate with you.`, "20px")}
      ${meetingDetails(c)}
      ${intakeBlock}
    `,
    "winded.vertigo · automatic host notification",
  );
}

export function buildVisitorCancellationHtml(c: BookingEmailContext): string {
  const firstName = c.visitorName.split(" ")[0].toLowerCase();
  return wvShell(
    "your playdate is cancelled",
    `
      ${wvPara(`hi ${escapeHtml(firstName)},`)}
      ${wvPara("your playdate has been cancelled. the calendar invite was removed.", "20px")}
      ${meetingDetails(c)}
      ${wvPara(`when you're ready, you can <a href="https://www.windedvertigo.com/quadrants/" style="color: #b15043;">book again here</a>.`, "16px")}
    `,
    "winded.vertigo · cancellation confirmation",
  );
}

export function buildHostCancellationHtml(
  c: BookingEmailContext,
  forHostName: string,
): string {
  return wvShell(
    "playdate cancelled",
    `
      ${wvPara(`hi ${escapeHtml(forHostName)},`)}
      ${wvPara(`the playdate with ${escapeHtml(c.visitorName)} (${escapeHtml(c.visitorEmail)}) was cancelled. your calendar event was removed.`, "20px")}
      ${meetingDetails(c)}
    `,
    "winded.vertigo · automatic host notification",
  );
}

/* ── send helpers (return aggregate success) ─────────────────── */

export async function sendBookingConfirmations(
  c: BookingEmailContext,
): Promise<{ visitor: ResendResult; hosts: ResendResult[] }> {
  const visitor = await sendEmail({
    to: c.visitorEmail,
    subject: `playdate booked: ${formatDateOnly(c.startAt, c.visitorTz)} — winded.vertigo`,
    html: buildVisitorConfirmationHtml(c),
  });
  const hosts = await Promise.all(
    c.hostEmails.map((email, i) =>
      sendEmail({
        to: email,
        subject: `new playdate: ${c.visitorName} on ${formatDateOnly(c.startAt, c.visitorTz)}`,
        html: buildHostNotificationHtml(c, c.hostNames[i] ?? "there"),
        replyTo: c.visitorEmail,
      }),
    ),
  );
  return { visitor, hosts };
}

export async function sendCancellationNotifications(
  c: BookingEmailContext,
): Promise<{ visitor: ResendResult; hosts: ResendResult[] }> {
  const visitor = await sendEmail({
    to: c.visitorEmail,
    subject: `playdate cancelled: ${formatDateOnly(c.startAt, c.visitorTz)}`,
    html: buildVisitorCancellationHtml(c),
  });
  const hosts = await Promise.all(
    c.hostEmails.map((email, i) =>
      sendEmail({
        to: email,
        subject: `playdate cancelled: ${c.visitorName} ${formatDateOnly(c.startAt, c.visitorTz)}`,
        html: buildHostCancellationHtml(c, c.hostNames[i] ?? "there"),
      }),
    ),
  );
  return { visitor, hosts };
}

/* ── reschedule templates ──────────────────────────────────────── */

export interface RescheduleEmailContext extends BookingEmailContext {
  oldStartAt: Date;
  oldEndAt: Date;
}

export function buildVisitorRescheduleHtml(c: RescheduleEmailContext): string {
  const firstName = c.visitorName.split(" ")[0].toLowerCase();
  return wvShell(
    "your playdate moved",
    `
      ${wvPara(`hi ${escapeHtml(firstName)},`)}
      ${wvPara("your playdate has been rescheduled. the calendar invite was updated.", "20px")}
      ${wvCompactRow("from", formatDateRange(c.oldStartAt, c.oldEndAt, c.visitorTz))}
      ${wvCompactRow("to", formatDateRange(c.startAt, c.endAt, c.visitorTz))}
      ${meetingDetails(c)}
      <div style="margin-top: 8px;">
        ${ctaButton(c.rescheduleUrl, "reschedule again", "ghost")}
        ${ctaButton(c.cancelUrl, "cancel", "ghost")}
      </div>
    `,
    "winded.vertigo · reschedule confirmation",
  );
}

export function buildHostRescheduleHtml(
  c: RescheduleEmailContext,
  forHostName: string,
): string {
  return wvShell(
    "playdate moved",
    `
      ${wvPara(`hi ${escapeHtml(forHostName)},`)}
      ${wvPara(`${escapeHtml(c.visitorName)} (${escapeHtml(c.visitorEmail)}) rescheduled their playdate. your calendar event was updated.`, "20px")}
      ${wvCompactRow("from", formatDateRange(c.oldStartAt, c.oldEndAt, c.visitorTz))}
      ${wvCompactRow("to", formatDateRange(c.startAt, c.endAt, c.visitorTz))}
      ${meetingDetails(c)}
    `,
    "winded.vertigo · automatic host notification",
  );
}

export async function sendRescheduleNotifications(
  c: RescheduleEmailContext,
): Promise<{ visitor: ResendResult; hosts: ResendResult[] }> {
  const visitor = await sendEmail({
    to: c.visitorEmail,
    subject: `playdate rescheduled: ${formatDateOnly(c.startAt, c.visitorTz)}`,
    html: buildVisitorRescheduleHtml(c),
  });
  const hosts = await Promise.all(
    c.hostEmails.map((email, i) =>
      sendEmail({
        to: email,
        subject: `playdate moved: ${c.visitorName} → ${formatDateOnly(c.startAt, c.visitorTz)}`,
        html: buildHostRescheduleHtml(c, c.hostNames[i] ?? "there"),
      }),
    ),
  );
  return { visitor, hosts };
}

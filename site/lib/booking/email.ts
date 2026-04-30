/**
 * Booking email templates + Resend transport.
 *
 * Reuses the same Resend fetch pattern as lib/email/send-package.ts.
 * Brand HTML: cadet (#273248) bg, redwood (#b15043) accents, Inter font,
 * lowercase headings, max-width 480-520px centered divs.
 *
 * Four templates:
 *   - visitorConfirmation  → booking confirmed (with cancel/reschedule links)
 *   - hostNotification     → "you have a booking"
 *   - visitorCancellation  → booking cancelled
 *   - hostCancellation     → host notified of cancellation
 */

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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRange(start: Date, end: Date, tz: string): string {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)} → ${timeFmt.format(end)}`;
}

function shell(headline: string, bodyInner: string, footer: string): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 20px; font-weight: 600; margin-bottom: 4px; text-transform: lowercase;">
        ${headline}
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 24px;">
        winded.vertigo
      </p>
      ${bodyInner}
      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 28px 0 16px;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px; margin: 0;">
        ${footer}
      </p>
    </div>
  `;
}

function ctaButton(href: string, label: string, variant: "primary" | "ghost" = "primary"): string {
  if (variant === "ghost") {
    return `<a href="${href}" style="display: inline-block; color: #b15043; text-decoration: underline; font-size: 13px; margin-right: 16px;">${escapeHtml(label)}</a>`;
  }
  return `<a href="${href}" style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-transform: lowercase;">${escapeHtml(label)}</a>`;
}

function meetingDetails(c: BookingEmailContext): string {
  const when = formatRange(c.startAt, c.endAt, c.visitorTz);
  const hosts = c.hostNames.length === 1
    ? c.hostNames[0]
    : c.hostNames.slice(0, -1).join(", ") + " and " + c.hostNames[c.hostNames.length - 1];
  return `
    <div style="background: rgba(39, 50, 72, 0.04); border-left: 3px solid #b15043; padding: 16px 20px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
      <div style="font-size: 13px; color: #273248; opacity: 0.6; margin-bottom: 4px; text-transform: lowercase;">${escapeHtml(c.eventTitle)}</div>
      <div style="font-size: 15px; color: #273248; font-weight: 600; margin-bottom: 6px;">${escapeHtml(when)}</div>
      <div style="font-size: 13px; color: #273248; opacity: 0.7;">with ${escapeHtml(hosts)} · ${c.durationMin} min</div>
      ${c.meetUrl ? `<div style="font-size: 13px; color: #273248; margin-top: 10px;">join → <a href="${c.meetUrl}" style="color: #b15043;">${escapeHtml(c.meetUrl)}</a></div>` : ""}
    </div>
  `;
}

/* ── templates ─────────────────────────────────────────────────── */

export function buildVisitorConfirmationHtml(c: BookingEmailContext): string {
  const firstName = c.visitorName.split(" ")[0].toLowerCase();
  return shell(
    "your playdate is booked",
    `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${escapeHtml(firstName)},
      </p>
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        we're looking forward to playing with you.
      </p>
      ${meetingDetails(c)}
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        we've added it to your calendar — see you soon.
      </p>
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
  return shell(
    "new playdate booked",
    `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${escapeHtml(forHostName)},
      </p>
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        ${escapeHtml(c.visitorName)} (${escapeHtml(c.visitorEmail)}) just booked a playdate with you.
      </p>
      ${meetingDetails(c)}
      ${
        c.intake?.curious || c.intake?.valuable
          ? `
        <div style="background: #273248; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
          ${
            c.intake.curious
              ? `<div style="margin-bottom: ${c.intake.valuable ? "12px" : "0"}">
                <div style="font-size: 11px; color: #cb7858; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">what made them curious</div>
                <div style="font-size: 13px; color: #ffffff; line-height: 1.6;">${escapeHtml(c.intake.curious)}</div>
              </div>`
              : ""
          }
          ${
            c.intake.valuable
              ? `<div>
                <div style="font-size: 11px; color: #cb7858; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">what feels valuable</div>
                <div style="font-size: 13px; color: #ffffff; line-height: 1.6;">${escapeHtml(c.intake.valuable)}</div>
              </div>`
              : ""
          }
        </div>
      `
          : ""
      }
    `,
    "winded.vertigo · automatic host notification",
  );
}

export function buildVisitorCancellationHtml(c: BookingEmailContext): string {
  const firstName = c.visitorName.split(" ")[0].toLowerCase();
  return shell(
    "your playdate is cancelled",
    `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${escapeHtml(firstName)},
      </p>
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        your playdate has been cancelled. the calendar invite was removed.
      </p>
      ${meetingDetails(c)}
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        when you're ready, you can <a href="https://www.windedvertigo.com/quadrants/" style="color: #b15043;">book again here</a>.
      </p>
    `,
    "winded.vertigo · cancellation confirmation",
  );
}

export function buildHostCancellationHtml(c: BookingEmailContext, forHostName: string): string {
  return shell(
    "playdate cancelled",
    `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${escapeHtml(forHostName)},
      </p>
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        the playdate with ${escapeHtml(c.visitorName)} (${escapeHtml(c.visitorEmail)}) was cancelled. your calendar event was removed.
      </p>
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

function meetingDetailsCompact(label: string, start: Date, end: Date, tz: string): string {
  const when = formatRange(start, end, tz);
  return `
    <div style="background: rgba(39, 50, 72, 0.04); padding: 12px 16px; margin-bottom: 12px; border-radius: 6px;">
      <div style="font-size: 11px; color: #273248; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${escapeHtml(label)}</div>
      <div style="font-size: 14px; color: #273248;">${escapeHtml(when)}</div>
    </div>
  `;
}

export function buildVisitorRescheduleHtml(c: RescheduleEmailContext): string {
  const firstName = c.visitorName.split(" ")[0].toLowerCase();
  return shell(
    "your playdate moved",
    `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${escapeHtml(firstName)},
      </p>
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        your playdate has been rescheduled. the calendar invite was updated.
      </p>
      ${meetingDetailsCompact("from", c.oldStartAt, c.oldEndAt, c.visitorTz)}
      ${meetingDetailsCompact("to", c.startAt, c.endAt, c.visitorTz)}
      ${meetingDetails(c)}
      <div style="margin-top: 8px;">
        ${ctaButton(c.rescheduleUrl, "reschedule again", "ghost")}
        ${ctaButton(c.cancelUrl, "cancel", "ghost")}
      </div>
    `,
    "winded.vertigo · reschedule confirmation",
  );
}

export function buildHostRescheduleHtml(c: RescheduleEmailContext, forHostName: string): string {
  return shell(
    "playdate moved",
    `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${escapeHtml(forHostName)},
      </p>
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        ${escapeHtml(c.visitorName)} (${escapeHtml(c.visitorEmail)}) rescheduled their playdate. your calendar event was updated.
      </p>
      ${meetingDetailsCompact("from", c.oldStartAt, c.oldEndAt, c.visitorTz)}
      ${meetingDetailsCompact("to", c.startAt, c.endAt, c.visitorTz)}
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

function formatDateOnly(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: tz,
  }).format(d);
}

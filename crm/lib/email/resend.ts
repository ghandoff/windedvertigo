/**
 * Resend email client — send outreach emails with tracking.
 */

import { Resend } from "resend";

/** Lazily initialized — avoids build-time crash when RESEND_API_KEY is unset. */
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const DOMAIN = process.env.RESEND_DOMAIN ?? "windedvertigo.com";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? `garrett@${DOMAIN}`;

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendOutreachEmail(params: SendEmailParams) {
  return getResend().emails.send({
    from: params.from ?? `winded.vertigo <hello@${DOMAIN}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo ?? REPLY_TO,
    tags: [
      ...(params.tags ?? []),
      { name: "source", value: "crm" },
    ],
  });
}

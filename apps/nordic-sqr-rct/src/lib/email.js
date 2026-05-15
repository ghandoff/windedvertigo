/**
 * Wave 7.3.1 — Resend email client.
 *
 * Single module for all transactional emails sent by the platform.
 * Lazy-init: the Resend client is constructed on first use so Next.js
 * build succeeds in environments without secrets.
 *
 * Usage:
 *   import { sendMagicLink } from '@/lib/email';
 *   await sendMagicLink({ to: 'jane@example.com', name: 'Jane', url: 'https://...' });
 */

import { Resend } from 'resend';

let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      'RESEND_API_KEY environment variable is required. ' +
      'Add it to .env.local (dev) or as a Wrangler secret (production).',
    );
  }
  _resend = new Resend(key);
  return _resend;
}

// ── From address ─────────────────────────────────────────────────────────────

// All platform mail comes from this address. Using a subdomain keeps
// transactional mail separate from Nordic marketing and allows SPF/DKIM
// to be scoped to the platform domain.
const FROM_ADDRESS = 'Nordic Research Platform <noreply@nordic.windedvertigo.com>';

// ── Magic link email ─────────────────────────────────────────────────────────

/**
 * Send a magic-link sign-in email to an external reviewer.
 *
 * @param {{ to: string, name: string, url: string }} opts
 *   - `to`   — recipient email
 *   - `name` — reviewer's first name (for personalisation; falls back to "there")
 *   - `url`  — the full magic-link URL (already includes the signed JWT)
 */
export async function sendMagicLink({ to, name, url }) {
  const displayName = name && name.trim() ? name.trim() : 'there';
  // Expire hint shown in the email body — must match MAGIC_LINK_TTL_MINUTES
  // in api/auth/magic-link/route.js.
  const EXPIRES_MINUTES = 15;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Nordic Research Platform sign-in link</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1a6080;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
                Nordic Research Platform
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                Substantiation · Review · Label intake
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Hi ${displayName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Click the button below to sign in to the Nordic Research Platform.
                This link expires in <strong>${EXPIRES_MINUTES} minutes</strong> and can only be used once.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#1a6080;">
                    <a href="${url}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;">
                      Sign in to Nordic Research
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                If the button doesn&apos;t work, copy and paste this URL into your browser:
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
                ${url}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                If you didn&apos;t request this link, you can safely ignore this email &mdash; your account has not been accessed.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} Nordic Naturals. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${displayName},

Click the link below to sign in to the Nordic Research Platform.
This link expires in ${EXPIRES_MINUTES} minutes and can only be used once.

${url}

If you didn't request this link, you can safely ignore this email — your account has not been accessed.

© ${new Date().getFullYear()} Nordic Naturals. All rights reserved.`;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [to],
    subject: 'Your Nordic Research Platform sign-in link',
    html,
    text,
  });

  if (error) {
    console.error('[email] Resend send failed:', error);
    throw new Error(`Failed to send magic link email: ${error.message}`);
  }

  return data;
}

/**
 * Email utilities for ancestry app — powered by Resend.
 *
 * Shares the same Resend account + verified domain as the CRM.
 * Lazily initializes to avoid build-time crashes when the key is unset
 * (e.g. in CI or local dev without env vars).
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const DOMAIN = process.env.RESEND_DOMAIN ?? "windedvertigo.com";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? `garrett@${DOMAIN}`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ancestry.windedvertigo.com";

// ─── invite email ────────────────────────────────────────────

export async function sendTreeInviteEmail({
  to,
  inviterName,
  treeName,
  role,
  treeId,
}: {
  to: string;
  inviterName: string;
  treeName: string;
  role: string;
  treeId: string;
}) {
  const treeUrl = `${APP_URL}?tree=${treeId}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <!-- header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #e4e4e7;">
              <div style="font-size:14px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">w.v ancestry</div>
            </td>
          </tr>
          <!-- body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
                ${inviterName} invited you to collaborate on the family tree <strong>${treeName}</strong> as ${article(role)} <strong>${role}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#71717a;">
                ${role === "editor"
                  ? "as an editor, you can add and edit people, relationships, and events."
                  : "as a viewer, you can browse the tree and see all the details."}
              </p>
              <a href="${treeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:13px;font-weight:500;text-decoration:none;padding:10px 20px;border-radius:6px;">
                open tree
              </a>
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;">
                you received this because ${inviterName} added your email to their family tree on
                <a href="${APP_URL}" style="color:#71717a;">w.v ancestry</a>.
                if this wasn't expected, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `${inviterName} invited you to collaborate on the family tree "${treeName}" as ${article(role)} ${role}.`,
    "",
    role === "editor"
      ? "as an editor, you can add and edit people, relationships, and events."
      : "as a viewer, you can browse the tree and see all the details.",
    "",
    `open the tree: ${treeUrl}`,
    "",
    "---",
    `you received this because ${inviterName} added your email to their family tree on w.v ancestry.`,
  ].join("\n");

  return getResend().emails.send({
    from: `w.v ancestry <ancestry@${DOMAIN}>`,
    to,
    subject: `${inviterName} invited you to a family tree`,
    html,
    text,
    replyTo: REPLY_TO,
    tags: [
      { name: "app", value: "ancestry" },
      { name: "type", value: "invite" },
    ],
  });
}

/** returns "a" or "an" depending on the word */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

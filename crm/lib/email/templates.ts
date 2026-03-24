/**
 * Email template builder — wraps body content in brand-consistent HTML.
 *
 * Surfaces the bespokeEmailCopy field from organizations as default body.
 */

import { brand, typography } from "@windedvertigo/tokens";

export function buildEmailHtml(
  body: string,
  opts?: { orgName?: string; senderName?: string },
): string {
  const senderName = opts?.senderName ?? "Garrett";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title></title>
</head>
<body style="margin:0; padding:0; background:${brand.champagne}; font-family:${typography.fontFamily}; line-height:${typography.lineHeight}; color:${brand.cadet};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; padding:32px 24px;">
    <tr><td>
      ${body}
    </td></tr>
    <tr><td style="padding-top:24px; border-top:1px solid #e5e7eb; margin-top:24px; font-size:14px; color:#6b7280;">
      ${senderName} &middot; winded.vertigo
    </td></tr>
  </table>
</body>
</html>`;
}

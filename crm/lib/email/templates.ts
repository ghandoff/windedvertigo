/**
 * Email template builder — wraps body content in brand-consistent HTML.
 *
 * Surfaces the bespokeEmailCopy field from organizations as default body.
 */

import { brand, typography } from "@windedvertigo/tokens";
import { inlineEmailStyles } from "./inline-styles";

/** True when `html` is a complete HTML document (has its own doctype/html/head). */
function isFullHtmlDocument(html: string): boolean {
  return /^\s*<!doctype\s+html/i.test(html) || /^\s*<html[\s>]/i.test(html);
}

/**
 * If the body is a partial HTML fragment (produced by Tiptap), extract content
 * as-is. Full HTML documents bypass wrapping entirely — see buildEmailHtml.
 */
function extractBodyFragment(html: string): string {
  const bodyContent = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyContent) return bodyContent[1].trim();
  // No <body> tag but has doctype/html — strip them
  if (/<!doctype|<html/i.test(html)) {
    return html
      .replace(/<!doctype[^>]*>/gi, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
      .trim();
  }
  return html;
}

/** Strip HTML tags to produce a plain-text fallback for spam filters. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  • ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildEmailHtml(
  body: string,
  opts?: {
    orgName?: string;
    senderName?: string;
    unsubscribeUrl?: string;
    viewInBrowserUrl?: string;
  },
): string {
  // Full HTML documents (Canva, Mailchimp templates) carry their own <head> CSS
  // for responsive layouts. Re-wrapping them strips that CSS, causing mobile +
  // desktop sections to both render in Gmail. Pass them through untouched —
  // template variables were already resolved by resolveTemplateVars() upstream.
  if (isFullHtmlDocument(body)) return body;

  const senderName = opts?.senderName ?? "Garrett";
  const fragment = extractBodyFragment(body);
  const safeBody = inlineEmailStyles(fragment);

  const footerLinks = [
    opts?.viewInBrowserUrl
      ? `<a href="${opts.viewInBrowserUrl}" style="color:#6b7280;text-decoration:underline;">view in browser</a>`
      : null,
    opts?.unsubscribeUrl
      ? `<a href="${opts.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">unsubscribe</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

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
      ${safeBody}
    </td></tr>
    <tr><td style="padding-top:24px; border-top:1px solid #e5e7eb; margin-top:24px; font-size:14px; color:#6b7280;">
      ${senderName} &middot; winded.vertigo${footerLinks ? ` &middot; ${footerLinks}` : ""}
    </td></tr>
  </table>
</body>
</html>`;
}

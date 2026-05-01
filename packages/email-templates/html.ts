/**
 * @windedvertigo/email-templates — HTML primitives
 *
 * Pure string helpers for building branded winded.vertigo emails.
 * Works in any runtime (Cloudflare Workers, Node.js, edge) — no SDK deps.
 *
 * Brand: cadet (#273248) backgrounds/text, redwood (#b15043) accents,
 *        champagne (#ffebd2) on-dark text, Inter font, lowercase headings.
 */

/* ── safety ─────────────────────────────────────────────────────── */

/**
 * Escape a string for safe injection into an HTML attribute or body.
 * Handles &, <, >, ", and '.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ── layout shell ───────────────────────────────────────────────── */

/**
 * Branded email wrapper — cadet text, Inter font, max-width 520px.
 *
 * @param headline  Short subject line shown as the email's <h2> (lowercase).
 * @param bodyInner HTML string rendered between the subtitle and the footer HR.
 * @param footer    Footer caption text (plain text, will be escaped).
 */
export function wvShell(
  headline: string,
  bodyInner: string,
  footer: string,
): string {
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
        ${escapeHtml(footer)}
      </p>
    </div>
  `;
}

/* ── interactive elements ───────────────────────────────────────── */

/**
 * Renders a CTA link styled as a button or ghost link.
 *
 * - `primary` — filled redwood (#b15043) background, white text.
 * - `ghost`   — redwood underline text, no background (saves visual weight for secondary actions).
 */
export function ctaButton(
  href: string,
  label: string,
  variant: "primary" | "ghost" = "primary",
): string {
  if (variant === "ghost") {
    return `<a href="${href}" style="display: inline-block; color: #b15043; text-decoration: underline; font-size: 13px; margin-right: 16px;">${escapeHtml(label)}</a>`;
  }
  return `<a href="${href}" style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-transform: lowercase;">${escapeHtml(label)}</a>`;
}

/* ── callout blocks ─────────────────────────────────────────────── */

/**
 * Renders a left-bordered info block (cadet tinted bg + redwood left border).
 * Used for meeting details, key data rows, etc.
 */
export function wvCallout(innerHtml: string): string {
  return `
    <div style="background: rgba(39, 50, 72, 0.04); border-left: 3px solid #b15043; padding: 16px 20px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
      ${innerHtml}
    </div>
  `;
}

/**
 * Renders a dark (cadet) card — used for highlighting intake responses,
 * visitor notes, or other "context for the host" blocks.
 */
export function wvDarkCard(innerHtml: string): string {
  return `
    <div style="background: #273248; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
      ${innerHtml}
    </div>
  `;
}

/**
 * A small labelled row inside a dark card.
 * @param label  Caption shown above the value (displayed in sienna/orange).
 * @param value  Main text content.
 * @param isLast Set true to suppress bottom margin on the last row.
 */
export function wvDarkRow(label: string, value: string, isLast = false): string {
  return `
    <div style="${isLast ? "" : "margin-bottom: 12px;"}">
      <div style="font-size: 11px; color: #cb7858; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${escapeHtml(label)}</div>
      <div style="font-size: 13px; color: #ffffff; line-height: 1.6;">${escapeHtml(value)}</div>
    </div>
  `;
}

/**
 * A compact (no border) summary row — used for before/after comparisons (reschedule).
 */
export function wvCompactRow(label: string, content: string): string {
  return `
    <div style="background: rgba(39, 50, 72, 0.04); padding: 12px 16px; margin-bottom: 12px; border-radius: 6px;">
      <div style="font-size: 11px; color: #273248; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${escapeHtml(label)}</div>
      <div style="font-size: 14px; color: #273248;">${escapeHtml(content)}</div>
    </div>
  `;
}

/* ── body text helpers ──────────────────────────────────────────── */

/**
 * Standard body paragraph — cadet text, 14px, 1.6 line-height.
 */
export function wvPara(html: string, marginBottom = "16px"): string {
  return `<p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: ${marginBottom};">${html}</p>`;
}

/**
 * @windedvertigo/email-templates
 *
 * Shared email HTML primitives for all winded.vertigo apps.
 * Import from this package instead of duplicating inline styles.
 *
 * @example
 *   import { wvShell, ctaButton, escapeHtml, formatDateRange } from "@windedvertigo/email-templates";
 *
 *   const html = wvShell("your booking", `
 *     ${wvPara(`hi ${escapeHtml(firstName)},`)}
 *     ${ctaButton("https://example.com/cancel", "cancel", "ghost")}
 *   `, "winded.vertigo · booking confirmation");
 */

export {
  escapeHtml,
  wvShell,
  ctaButton,
  wvCallout,
  wvDarkCard,
  wvDarkRow,
  wvCompactRow,
  wvPara,
} from "./html";

export { formatDateRange, formatDateOnly } from "./date";

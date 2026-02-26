import type { PDFPage, RGB } from "pdf-lib";
import type { DrawCtx } from "./types";
import { PAGE_W, PAGE_H, FOOTER_ZONE, MARGIN, CONTENT_W } from "./constants";

/**
 * Sanitise text for pdf-lib StandardFonts (WinAnsi / Windows-1252).
 */
export function sanitize(text: string): string {
  return text
    .replace(/\u2014/g, " - ")  // em dash
    .replace(/\u2013/g, " - ")  // en dash
    .replace(/\u2018/g, "'")    // left single quote
    .replace(/\u2019/g, "'")    // right single quote
    .replace(/\u201C/g, '"')    // left double quote
    .replace(/\u201D/g, '"')    // right double quote
    .replace(/\u2026/g, "...")   // ellipsis
    .replace(/\u00A0/g, " ")    // non-breaking space
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

/** Ensure enough room on the current page; if not, add a new page. */
export function ensureRoom(ctx: DrawCtx, need: number): void {
  if (ctx.y - need < FOOTER_ZONE + 10) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
  }
}

/** Word-wrap and draw text. Returns the new Y position. */
export function drawWrapped(
  ctx: DrawCtx,
  rawText: string,
  x: number,
  size: number,
  usedFont: any,
  colour: RGB,
  maxW: number = CONTENT_W,
  lineHeight: number = size * 1.5,
): number {
  const text = sanitize(rawText);
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = usedFont.widthOfTextAtSize(test, size);
    if (width > maxW && line) {
      ensureRoom(ctx, lineHeight);
      ctx.page.drawText(line, { x, y: ctx.y, size, font: usedFont, color: colour });
      ctx.y -= lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ensureRoom(ctx, lineHeight);
    ctx.page.drawText(line, { x, y: ctx.y, size, font: usedFont, color: colour });
    ctx.y -= lineHeight;
  }
  return ctx.y;
}

/** Draw a rounded rectangle (simulated with regular rect + clipping). */
export function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGB,
  borderColor?: RGB,
) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill });
  if (borderColor) {
    page.drawRectangle({
      x, y, width: w, height: h,
      borderColor,
      borderWidth: 0.5,
    });
  }
}

/** Draw a coloured accent bar on the left side of a card. */
export function drawAccentBar(page: PDFPage, x: number, y: number, h: number, colour: RGB) {
  page.drawRectangle({ x, y, width: 3, height: h, color: colour });
}

/** Format friction dial to human label. */
export function frictionLabel(dial: number | null): string {
  if (!dial) return "";
  if (dial <= 2) return `chill (${dial}/5)`;
  if (dial <= 3) return `medium (${dial}/5)`;
  return `high energy (${dial}/5)`;
}

/** Format array or comma-separated string. */
export function formatList(val: unknown): string {
  if (!val) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}
